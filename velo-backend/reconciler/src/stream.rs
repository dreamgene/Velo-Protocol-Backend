use anyhow::Result;
use futures_util::StreamExt;
use reqwest::Client;
use serde::Deserialize;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info};

use crate::config::Config;
use crate::metrics::Metrics;
use crate::processor::Processor;

#[derive(Debug, Deserialize, Clone)]
pub struct Payment {
    pub id: Option<String>,
    pub paging_token: String,
    #[serde(rename = "type")]
    pub payment_type: String,
    pub transaction_hash: String,
    pub from: String,
    pub to: String,
    pub amount: String,
    pub asset_code: Option<String>,
    pub asset_issuer: Option<String>,
    pub ledger_sequence: Option<u64>,
}

pub async fn listen_payments(
    config: Config,
    db: PgPool,
    redis: redis::aio::ConnectionManager,
    metrics: Arc<Metrics>,
    initial_cursor: String,
) {
    let processor = Arc::new(Processor {
        db: db.clone(),
        redis,
        config: config.clone(),
        metrics: metrics.clone(),
    });

    let mut cursor = initial_cursor;
    let mut backoff_secs = 1u64;

    loop {
        info!(cursor = %cursor, "Connecting to Horizon SSE stream");
        match stream_once(&config, &processor, &db, &mut cursor).await {
            Ok(()) => {
                backoff_secs = 1;
            }
            Err(err) => {
                metrics.stream_disconnects_total.inc();
                error!("Stream error: {err}. Reconnecting in {backoff_secs}s");
                tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                backoff_secs = (backoff_secs * 2).min(30);
            }
        }
    }
}

async fn stream_once(
    config: &Config,
    processor: &Arc<Processor>,
    db: &PgPool,
    cursor: &mut String,
) -> Result<()> {
    let url = format!(
        "{}/accounts/{}/payments?cursor={}&order=asc",
        config.horizon_url, config.treasury_public_key, cursor,
    );

    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()?;

    let response = client
        .get(&url)
        .header("Accept", "text/event-stream")
        .send()
        .await?;

    let mut stream = response.bytes_stream();

    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(event_end) = buffer.find("\n\n") {
            let event_block = buffer[..event_end].to_string();
            buffer = buffer[event_end + 2..].to_string();

            for line in event_block.lines() {
                if let Some(data) = line.strip_prefix("data: ") {
                    if data == r#"{"type":"close"}"# {
                        return Ok(());
                    }
                    if let Ok(payment) = serde_json::from_str::<Payment>(data) {
                        if payment.payment_type != "payment" {
                            continue;
                        }
                        let new_cursor = payment.paging_token.clone();
                        if let Err(err) = processor.process_payment(&payment).await {
                            error!("Failed to process payment {}: {err}", payment.paging_token);
                        }
                        *cursor = new_cursor.clone();
                        save_cursor(db, &new_cursor).await.ok();
                    }
                }
            }
        }
    }

    Ok(())
}

async fn save_cursor(db: &PgPool, cursor: &str) -> Result<()> {
    sqlx::query(
        "UPDATE reconciler_state SET value = $1, updated_at = now() WHERE key = 'cursor'",
    )
    .bind(cursor)
    .execute(db)
    .await?;
    Ok(())
}
