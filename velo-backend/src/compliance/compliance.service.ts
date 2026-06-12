import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export interface ScreenResult {
  allowed: boolean;
  risk_score: number;
  reason?: string;
}

@Injectable()
export class ComplianceService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async screen(stellarAddress: string, merchantId: string): Promise<ScreenResult> {
    if (!this.config.get<boolean>('OFAC_SCREENING_ENABLED')) {
      return { allowed: true, risk_score: 0 };
    }

    const cacheKey = `velo:ofac:${stellarAddress}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    let result: ScreenResult;
    const trmKey = this.config.get<string>('TRM_LABS_API_KEY');

    if (trmKey) {
      result = await this.callTrmLabs(stellarAddress, trmKey);
    } else {
      result = { allowed: true, risk_score: 50, reason: 'screening_skipped' };
    }

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);

    const velocityKey = `velo:velocity:${merchantId}:${new Date().getUTCHours()}`;
    await this.redis.incr(velocityKey);
    await this.redis.expire(velocityKey, 3600);

    return result;
  }

  private async callTrmLabs(address: string, apiKey: string): Promise<ScreenResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch('https://api.trmlabs.com/public/v1/sanctions/screening', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        },
        body: JSON.stringify([{ address, chain: 'stellar' }]),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { allowed: true, risk_score: 50, reason: 'screening_error' };
      }

      const data = await response.json() as any[];
      const result = data[0];
      const riskScore = result?.riskScore ?? 0;
      const isSanctioned = result?.isSanctioned ?? false;

      return {
        allowed: !isSanctioned && riskScore < 70,
        risk_score: riskScore,
        reason: isSanctioned ? 'sanctioned' : undefined,
      };
    } catch {
      return { allowed: true, risk_score: 50, reason: 'screening_timeout' };
    }
  }
}
