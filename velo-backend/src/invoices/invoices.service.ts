import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { DATABASE_POOL } from '../database/database.module';

export interface FeeCalculation {
  amount_usdc: string;
  fee_usdc: string;
  gross_usdc: string;
  net_usdc: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DATABASE_POOL) private readonly db: Pool,
    private readonly config: ConfigService,
  ) {}

  calculateFee(amountUsdc: number, tier: string, customFeeBps?: number, customFeeFixed?: number): FeeCalculation {
    let feeBps: number;
    let feeFixed: number;

    if (tier === 'enterprise' && customFeeBps !== undefined) {
      feeBps = customFeeBps;
      feeFixed = customFeeFixed ?? 0;
    } else if (tier === 'pro') {
      feeBps = 30;
      feeFixed = 0.10;
    } else {
      feeBps = 50;
      feeFixed = 0.25;
    }

    const fee = (amountUsdc * feeBps) / 10000 + feeFixed;
    const gross = amountUsdc + fee;
    const net = amountUsdc;

    return {
      amount_usdc: amountUsdc.toFixed(7),
      fee_usdc: fee.toFixed(7),
      gross_usdc: gross.toFixed(7),
      net_usdc: net.toFixed(7),
    };
  }

  buildMuxedAddress(muxedBaseId: bigint, invoiceSeq: bigint): string {
    const muxed = new StellarSdk.MuxedAccount(
      new StellarSdk.Account(this.config.get<string>('STELLAR_TREASURY_PUBLIC_KEY')!, '0'),
      (muxedBaseId * BigInt(1_000_000) + invoiceSeq).toString(),
    );
    return muxed.accountId();
  }

  private normalize(invoice: any, muxedAddress?: string): any {
    return {
      ...invoice,
      muxed_address: muxedAddress ?? invoice.muxed_address,
      gross_amount: invoice.gross_usdc ?? invoice.gross_amount,
      net_amount: invoice.net_usdc ?? invoice.net_amount,
      fee_amount: invoice.fee_usdc ?? invoice.fee_amount,
    };
  }

  async create(merchantId: string, amountUsdc: number, description?: string, expiresInMinutes = 60) {
    const { rows: [merchant] } = await this.db.query(
      'SELECT tier, fee_bps, fee_fixed_usdc, muxed_base_id FROM merchants WHERE id = $1',
      [merchantId],
    );
    if (!merchant) throw new NotFoundException('Merchant not found');

    const fees = this.calculateFee(
      amountUsdc,
      merchant.tier,
      merchant.fee_bps,
      parseFloat(merchant.fee_fixed_usdc),
    );

    const { rows: [seqRow] } = await this.db.query('SELECT claim_invoice_seq() AS seq');
    const muxedId = BigInt(seqRow.seq);
    const muxedAddress = this.buildMuxedAddress(BigInt(merchant.muxed_base_id), muxedId);

    const { rows: [invoice] } = await this.db.query(
      `INSERT INTO invoices
         (merchant_id, amount_usdc, gross_usdc, fee_usdc, net_usdc, muxed_id, description, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() + ($8 || ' minutes')::interval)
       RETURNING *`,
      [
        merchantId,
        fees.amount_usdc,
        fees.gross_usdc,
        fees.fee_usdc,
        fees.net_usdc,
        muxedId.toString(),
        description ?? null,
        expiresInMinutes,
      ],
    );

    return this.normalize(invoice, muxedAddress);
  }

  async findOne(id: string, merchantId: string) {
    const { rows: [invoice] } = await this.db.query(
      `SELECT i.*, m.muxed_base_id FROM invoices i
       JOIN merchants m ON m.id = i.merchant_id
       WHERE i.id = $1 AND i.merchant_id = $2`,
      [id, merchantId],
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    const muxedAddress = this.buildMuxedAddress(BigInt(invoice.muxed_base_id), BigInt(invoice.muxed_id));
    return this.normalize(invoice, muxedAddress);
  }

  async findPublic(id: string) {
    const { rows: [invoice] } = await this.db.query(
      `SELECT i.id, i.amount_usdc, i.gross_usdc, i.fee_usdc, i.net_usdc, i.description,
              i.status, i.expires_at, i.muxed_id, m.name AS merchant_name, m.muxed_base_id
       FROM invoices i
       JOIN merchants m ON m.id = i.merchant_id
       WHERE i.id = $1`,
      [id],
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    const muxedAddress = this.buildMuxedAddress(BigInt(invoice.muxed_base_id), BigInt(invoice.muxed_id));
    return this.normalize(invoice, muxedAddress);
  }

  async findMany(merchantId: string, cursor?: string, limit = 20, status?: string) {
    let query = `SELECT * FROM invoices WHERE merchant_id = $1`;
    const params: any[] = [merchantId];
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (cursor) {
      const [cursorCreatedAt, cursorId] = cursor.split('_');
      params.push(cursorCreatedAt, cursorId);
      query += ` AND (created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
    }
    params.push(limit + 1);
    query += ` ORDER BY created_at DESC, id DESC LIMIT $${params.length}`;

    const { rows } = await this.db.query(query, params);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => this.normalize(r));
    const nextCursor = hasMore
      ? `${items[items.length - 1].created_at.toISOString()}_${items[items.length - 1].id}`
      : null;

    return { items, next_cursor: nextCursor };
  }

  async cancel(id: string, merchantId: string) {
    const { rows: [invoice] } = await this.db.query(
      `UPDATE invoices SET status = 'cancelled' WHERE id = $1 AND merchant_id = $2 AND status = 'pending' RETURNING *`,
      [id, merchantId],
    );
    if (!invoice) throw new BadRequestException('Invoice cannot be cancelled');
    return invoice;
  }

  async expireStale() {
    const { rowCount } = await this.db.query(
      `UPDATE invoices SET status = 'expired' WHERE status = 'pending' AND expires_at < now()`,
    );
    return rowCount ?? 0;
  }
}
