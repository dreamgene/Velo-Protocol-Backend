use anyhow::Result;
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::config::Config;
use crate::matcher::decode_muxed_id;
use crate::metrics::Metrics;
use crate::stream::Payment;

pub struct Processor {
    pub db: PgPool,
    pub redis: redis::aio::ConnectionManager,
    pub config: Config,
    pub metrics: Arc<Metrics>,
}

impl Processor {
    pub async fn process_payment(&self, payment: &Payment) -> Result<()> {
        let start = std::time::Instant::now();
        self.metrics.payments_processed_total.inc();

        // Idempotency check
        let existing = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM payment_events WHERE paging_token = $1",
        )
        .bind(&payment.paging_token)
        .fetch_one(&self.db)
        .await?;

        if existing > 0 {
            debug!(paging_token = %payment.paging_token, "already processed, skipping");
            return Ok(());
        }

        // Filter USDC only
        if payment.asset_code.as_deref() != Some(&self.config.usdc_asset_code)
            || payment.asset_issuer.as_deref() != Some(&self.config.usdc_asset_issuer)
        {
            debug!(tx_hash = %payment.transaction_hash, "non-USDC payment, skipping");
            return Ok(());
        }

        // Match invoice
        let invoice = self.match_invoice(&payment.to).await?;
        let Some(invoice) = invoice else {
            debug!(tx_hash = %payment.transaction_hash, "no invoice matched");
            self.metrics.payments_unmatched_total.inc();
            return Ok(());
        };

        // Amount verification (within 1 stroop = 0.0000001 USDC)
        let payment_amount: f64 = payment.amount.parse().unwrap_or(0.0);
        let gross_usdc: f64 = invoice.gross_usdc.parse().unwrap_or(0.0);
        let tolerance = 0.0000001_f64;
        if payment_amount < gross_usdc - tolerance {
            warn!(
                tx_hash = %payment.transaction_hash,
                expected = gross_usdc,
                received = payment_amount,
                "insufficient payment amount"
            );
            return Ok(());
        }

        // Atomic DB transaction
        let mut tx = self.db.begin().await?;

        sqlx::query(
            r#"
            INSERT INTO payment_events
              (paging_token, invoice_id, payer_address, stellar_tx_hash, amount_usdc, ledger_sequence, ofac_result)
            VALUES ($1, $2, $3, $4, $5, $6, 'pass')
            "#,
        )
        .bind(&payment.paging_token)
        .bind(&invoice.id)
        .bind(&payment.from)
        .bind(&payment.transaction_hash)
        .bind(&payment.amount)
        .bind(payment.ledger_sequence.map(|s| s as i64))
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = $1 AND status = 'pending'",
        )
        .bind(&invoice.id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO ledger_entries
              (invoice_id, merchant_id, gross_usdc, fee_usdc, net_usdc, type)
            VALUES ($1, $2, $3, $4, $5, 'payment')
            "#,
        )
        .bind(&invoice.id)
        .bind(&invoice.merchant_id)
        .bind(&invoice.gross_usdc)
        .bind(&invoice.fee_usdc)
        .bind(&invoice.net_usdc)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        // Publish to Redis for SSE
        let message = json!({ "status": "paid", "tx_hash": payment.transaction_hash });
        let channel = format!("velo:invoice:{}", invoice.id);
        let mut conn = self.redis.clone();
        redis::cmd("PUBLISH")
            .arg(&channel)
            .arg(message.to_string())
            .query_async::<redis::aio::ConnectionManager, ()>(&mut conn)
            .await?;

        // Enqueue webhook
        self.enqueue_webhook(&invoice.merchant_id, &invoice.id, &payment.transaction_hash).await?;

        let elapsed = start.elapsed().as_millis() as f64;
        self.metrics.payment_processing_duration_ms.observe(elapsed);
        self.metrics.payments_matched_total.inc();

        info!(
            paging_token = %payment.paging_token,
            invoice_id = %invoice.id,
            amount = %payment.amount,
            duration_ms = elapsed,
            "payment matched and settled"
        );

        Ok(())
    }

    async fn match_invoice(&self, destination: &str) -> Result<Option<InvoiceRow>> {
        let muxed_id = decode_muxed_id(destination);
        if let Some(id) = muxed_id {
            let row = sqlx::query_as::<_, InvoiceRow>(
                r#"
                SELECT i.id, i.merchant_id, i.gross_usdc, i.fee_usdc, i.net_usdc
                FROM invoices i
                WHERE i.muxed_id = $1 AND i.status = 'pending'
                "#,
            )
            .bind(id as i64)
            .fetch_optional(&self.db)
            .await?;
            return Ok(row);
        }
        Ok(None)
    }

    async fn enqueue_webhook(&self, merchant_id: &str, invoice_id: &str, tx_hash: &str) -> Result<()> {
        let rows = sqlx::query_as::<_, (String,)>(
            "SELECT id FROM webhooks WHERE merchant_id = $1 AND is_active = true AND $2 = ANY(events)",
        )
        .bind(merchant_id)
        .bind("invoice.paid")
        .fetch_all(&self.db)
        .await?;

        let mut conn = self.redis.clone();
        for (webhook_id,) in rows {
            let payload = json!({
                "event": "invoice.paid",
                "invoice_id": invoice_id,
                "tx_hash": tx_hash,
            });
            redis::cmd("XADD")
                .arg("velo:webhooks")
                .arg("*")
                .arg("webhook_id").arg(&webhook_id)
                .arg("event_type").arg("invoice.paid")
                .arg("payload").arg(payload.to_string())
                .arg("delivery_id").arg(uuid::Uuid::new_v4().to_string())
                .query_async::<redis::aio::ConnectionManager, ()>(&mut conn)
                .await?;
        }

        Ok(())
    }
}

#[derive(Debug, sqlx::FromRow)]
pub struct InvoiceRow {
    pub id: String,
    pub merchant_id: String,
    pub gross_usdc: String,
    pub fee_usdc: String,
    pub net_usdc: String,
}
