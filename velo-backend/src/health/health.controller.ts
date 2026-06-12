import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { DATABASE_POOL } from '../database/database.module';
import { REDIS_CLIENT } from '../redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_POOL) private readonly db: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async check() {
    const start = Date.now();
    const [dbMs, redisMs] = await Promise.all([
      this.pingDb(),
      this.pingRedis(),
    ]);
    return { status: 'ok', db_ms: dbMs, redis_ms: redisMs, uptime_ms: Date.now() - start };
  }

  @Get('deep')
  async deep() {
    const [dbMs, redisMs, horizonMs] = await Promise.all([
      this.pingDb(),
      this.pingRedis(),
      this.pingHorizon(),
    ]);
    const allOk = dbMs >= 0 && redisMs >= 0 && horizonMs >= 0;
    return {
      status: allOk ? 'ok' : 'degraded',
      db_ms: dbMs,
      redis_ms: redisMs,
      horizon_ms: horizonMs,
    };
  }

  @Get('rpc')
  async rpc() {
    const horizonUrl = this.config.get('STELLAR_HORIZON_URL');
    return { horizon_url: horizonUrl, status: 'ok' };
  }

  private async pingDb(): Promise<number> {
    const t = Date.now();
    try {
      await Promise.race([
        this.db.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
      return Date.now() - t;
    } catch {
      return -1;
    }
  }

  private async pingRedis(): Promise<number> {
    const t = Date.now();
    try {
      await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
      return Date.now() - t;
    } catch {
      return -1;
    }
  }

  private async pingHorizon(): Promise<number> {
    const t = Date.now();
    try {
      const url = this.config.get<string>('STELLAR_HORIZON_URL')!;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      return Date.now() - t;
    } catch {
      return -1;
    }
  }
}
