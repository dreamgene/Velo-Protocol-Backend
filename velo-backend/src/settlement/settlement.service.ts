import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';
import { StellarService } from '../stellar/stellar.service';

const MIN_SETTLEMENT_USDC = 1.0;

@Injectable()
export class SettlementService {
  constructor(
    @Inject(DATABASE_POOL) private readonly db: Pool,
    private readonly stellar: StellarService,
  ) {}

  @Cron('0 2 * * *')
  async createDailySettlements() {
    const { rows: pending } = await this.db.query(`
      SELECT merchant_id, SUM(net_usdc) AS total_net
      FROM ledger_entries
      WHERE settlement_id IS NULL AND type = 'payment'
      GROUP BY merchant_id
      HAVING SUM(net_usdc) >= $1
    `, [MIN_SETTLEMENT_USDC]);

    for (const row of pending) {
      await this.settleForMerchant(row.merchant_id, parseFloat(row.total_net));
    }
  }

  async settleForMerchant(merchantId: string, amountUsdc: number) {
    const { rows: [merchant] } = await this.db.query(
      'SELECT stellar_address FROM merchants WHERE id = $1',
      [merchantId],
    );
    if (!merchant?.stellar_address) return;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const { rows: [settlement] } = await client.query(
        `INSERT INTO settlements (merchant_id, amount_usdc, status)
         VALUES ($1, $2, 'pending') RETURNING id`,
        [merchantId, amountUsdc.toFixed(7)],
      );

      await client.query(
        `UPDATE ledger_entries SET settlement_id = $1
         WHERE merchant_id = $2 AND settlement_id IS NULL AND type = 'payment'`,
        [settlement.id, merchantId],
      );

      await client.query(
        `UPDATE settlements SET status = 'processing' WHERE id = $1`,
        [settlement.id],
      );

      await client.query('COMMIT');

      await this.executeSettlement(settlement.id, merchant.stellar_address, amountUsdc);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Settlement failed for merchant ${merchantId}:`, err);
    } finally {
      client.release();
    }
  }

  private async executeSettlement(settlementId: string, destination: string, amountUsdc: number) {
    try {
      const txHash = await this.stellar.buildAndSubmitSettlementPayment(
        destination,
        amountUsdc.toFixed(7),
      );
      await this.db.query(
        `UPDATE settlements SET status = 'completed', settled_at = now(), tx_hash = $2 WHERE id = $1`,
        [settlementId, txHash],
      );
    } catch (err) {
      await this.db.query(
        `UPDATE settlements SET status = 'failed' WHERE id = $1`,
        [settlementId],
      );
      throw err;
    }
  }

  async getSettlements(merchantId: string) {
    const { rows } = await this.db.query(
      'SELECT * FROM settlements WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT 50',
      [merchantId],
    );
    return rows;
  }
}
