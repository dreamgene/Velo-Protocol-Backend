import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { DATABASE_POOL } from '../database/database.module';
import { REDIS_CLIENT } from '../redis/redis.module';

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^::1$/,
  /^localhost$/i,
];

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(DATABASE_POOL) private readonly db: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async create(merchantId: string, url: string, events: string[]) {
    this.validateWebhookUrl(url);
    const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

    const { rows: [webhook] } = await this.db.query(
      `INSERT INTO webhooks (merchant_id, url, secret_hash, events)
       VALUES ($1, $2, $3, $4) RETURNING id, url, events, created_at`,
      [merchantId, url, secretHash, events],
    );

    return { ...webhook, secret };
  }

  async list(merchantId: string) {
    const { rows } = await this.db.query(
      'SELECT id, url, events, is_active, created_at FROM webhooks WHERE merchant_id = $1 ORDER BY created_at DESC',
      [merchantId],
    );
    return rows;
  }

  async delete(merchantId: string, webhookId: string) {
    const { rowCount } = await this.db.query(
      'DELETE FROM webhooks WHERE id = $1 AND merchant_id = $2',
      [webhookId, merchantId],
    );
    if (!rowCount) throw new NotFoundException('Webhook not found');
  }

  async getDeliveries(merchantId: string, webhookId: string) {
    const { rows } = await this.db.query(
      `SELECT wd.* FROM webhook_deliveries wd
       JOIN webhooks w ON w.id = wd.webhook_id
       WHERE wd.webhook_id = $1 AND w.merchant_id = $2
       ORDER BY wd.created_at DESC LIMIT 50`,
      [webhookId, merchantId],
    );
    return rows;
  }

  async enqueue(webhookId: string, eventType: string, payload: object) {
    const streamKey = 'velo:webhooks';
    await this.redis.xadd(streamKey, '*',
      'webhook_id', webhookId,
      'event_type', eventType,
      'payload', JSON.stringify(payload),
      'delivery_id', crypto.randomUUID(),
    );
  }

  sign(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  verify(payload: string, signature: string, secret: string): boolean {
    const expected = this.sign(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  }

  private validateWebhookUrl(url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Webhook URL must use HTTPS');
    }
    const host = parsed.hostname;
    if (PRIVATE_IP_RANGES.some(re => re.test(host))) {
      throw new BadRequestException('Webhook URL cannot target private IP ranges');
    }
  }
}
