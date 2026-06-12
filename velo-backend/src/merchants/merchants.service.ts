import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';

@Injectable()
export class MerchantsService {
  constructor(@Inject(DATABASE_POOL) private readonly db: Pool) {}

  async getProfile(merchantId: string) {
    const { rows: [merchant] } = await this.db.query(
      'SELECT id, email, name, tier, status, stellar_address, fee_bps, fee_fixed_usdc, settlement_cadence, kyb_verified_at, created_at FROM merchants WHERE id = $1',
      [merchantId],
    );
    return merchant;
  }

  async updateProfile(merchantId: string, data: { name?: string; stellar_address?: string }) {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (data.name) { fields.push(`name = $${i++}`); values.push(data.name); }
    if (data.stellar_address !== undefined) { fields.push(`stellar_address = $${i++}`); values.push(data.stellar_address); }

    if (!fields.length) return this.getProfile(merchantId);
    values.push(merchantId);

    const { rows: [merchant] } = await this.db.query(
      `UPDATE merchants SET ${fields.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING id, email, name, tier, status, stellar_address`,
      values,
    );
    return merchant;
  }

  async getDashboardStats(merchantId: string) {
    const { rows: [stats] } = await this.db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN DATE(paid_at) = CURRENT_DATE THEN gross_usdc ELSE 0 END), 0) AS gmv_today,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', now()) THEN gross_usdc ELSE 0 END), 0) AS gmv_month,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_invoices,
        COUNT(*) FILTER (WHERE status = 'paid') AS paid_invoices
      FROM invoices
      WHERE merchant_id = $1
    `, [merchantId]);

    const { rows: [lastSettlement] } = await this.db.query(
      `SELECT amount_usdc, settled_at FROM settlements WHERE merchant_id = $1 AND status = 'completed' ORDER BY settled_at DESC LIMIT 1`,
      [merchantId],
    );

    return {
      ...stats,
      invoices_paid_count: Number(stats.paid_invoices),
      invoices_pending_count: Number(stats.pending_invoices),
      last_settlement: lastSettlement ?? null,
      last_settlement_at: lastSettlement?.settled_at ?? null,
      last_settlement_amount: lastSettlement?.amount_usdc ?? null,
    };
  }
}
