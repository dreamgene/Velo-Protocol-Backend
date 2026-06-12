import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { DATABASE_POOL } from '../database/database.module';
import { REDIS_CLIENT } from '../redis/redis.module';

const BACKOFF_MINUTES = [0, 1, 5, 30, 120];
const MAX_ATTEMPTS = 5;
const GROUP = 'VELO-WEBHOOKS';
const STREAM = 'velo:webhooks';

@Injectable()
export class WebhookConsumer implements OnModuleInit, OnModuleDestroy {
  private running = false;
  private consumer: Redis | null = null;

  constructor(
    @Inject(DATABASE_POOL) private readonly db: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    try {
      await this.redis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM');
    } catch {
      // group already exists
    }
    this.consumer = this.redis.duplicate();
    this.running = true;
    this.consume().catch(console.error);
  }

  onModuleDestroy() {
    this.running = false;
    this.consumer?.disconnect();
  }

  private async consume() {
    const hostname = process.env.HOSTNAME ?? crypto.randomUUID();
    while (this.running) {
      try {
        const results = await this.consumer!.xreadgroup(
          'GROUP', GROUP, hostname,
          'COUNT', '10',
          'BLOCK', '5000',
          'STREAMS', STREAM, '>',
        ) as any[];

        if (!results) continue;

        for (const [, entries] of results) {
          for (const [id, fields] of entries) {
            const data: Record<string, string> = {};
            for (let i = 0; i < fields.length; i += 2) {
              data[fields[i]] = fields[i + 1];
            }
            await this.deliver(data);
            await this.consumer!.xack(STREAM, GROUP, id);
          }
        }
      } catch (err) {
        if (this.running) console.error('Webhook consumer error:', err);
      }
    }
  }

  private async deliver(data: Record<string, string>) {
    const { webhook_id, event_type, payload } = data;

    const { rows: [webhook] } = await this.db.query(
      'SELECT url, secret_hash, is_active FROM webhooks WHERE id = $1',
      [webhook_id],
    );
    if (!webhook || !webhook.is_active) return;

    const { rows: [delivery] } = await this.db.query(
      `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status, attempts)
       VALUES ($1, $2, $3, 'pending', 0) RETURNING id`,
      [webhook_id, event_type, payload],
    );

    const secret = webhook.secret_hash;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        const delayMs = BACKOFF_MINUTES[attempt] * 60 * 1000;
        await new Promise(r => setTimeout(r, delayMs));
      }

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-velo-signature': signature,
            'x-velo-event': event_type,
          },
          body: payload,
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });

        const responseBody = await response.text().catch(() => '');
        const status = response.ok ? 'delivered' : 'failed';

        await this.db.query(
          `UPDATE webhook_deliveries
           SET status = $1, attempts = $2, response_status = $3, response_body = $4, updated_at = now()
           WHERE id = $5`,
          [status, attempt + 1, response.status, responseBody.slice(0, 500), delivery.id],
        );

        if (response.ok) return;
      } catch (err) {
        await this.db.query(
          `UPDATE webhook_deliveries SET attempts = $1, status = 'failed', updated_at = now() WHERE id = $2`,
          [attempt + 1, delivery.id],
        );
      }
    }

    await this.db.query(
      `UPDATE webhook_deliveries SET status = 'dead', updated_at = now() WHERE id = $1`,
      [delivery.id],
    );
  }
}
