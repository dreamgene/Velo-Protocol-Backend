import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { DATABASE_POOL } from '../database/database.module';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_POOL) private readonly db: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string, name: string) {
    const existing = await this.db.query('SELECT id FROM merchants WHERE email = $1', [email]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows: [merchant] } = await this.db.query(
      `INSERT INTO merchants (email, password_hash, name, status)
       VALUES ($1, $2, $3, 'active') RETURNING id, email, name, tier, status`,
      [email, passwordHash, name],
    );
    const muxedBaseId = await this.db.query(
      'SELECT claim_muxed_base_id($1) AS muxed_base_id',
      [merchant.id],
    );
    await this.db.query(
      'UPDATE merchants SET muxed_base_id = $1 WHERE id = $2',
      [muxedBaseId.rows[0].muxed_base_id, merchant.id],
    );
    const tokens = await this.issueTokens(merchant.id);
    return { ...tokens, merchant: { id: merchant.id, email: merchant.email, name: merchant.name, tier: merchant.tier } };
  }

  async login(email: string, password: string) {
    const { rows: [merchant] } = await this.db.query(
      'SELECT id, email, name, tier, status, password_hash FROM merchants WHERE email = $1',
      [email],
    );
    if (!merchant) throw new UnauthorizedException('Invalid credentials');
    if (merchant.status === 'suspended') throw new ForbiddenException('Account suspended');
    const valid = await bcrypt.compare(password, merchant.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    const tokens = await this.issueTokens(merchant.id);
    return { ...tokens, merchant: { id: merchant.id, email: merchant.email, name: merchant.name, tier: merchant.tier } };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const key = await this.findRefreshKey(tokenHash);
    if (!key) throw new UnauthorizedException('Invalid refresh token');
    const [, merchantId] = key.split(':').slice(1);
    await this.redis.del(key);
    return this.issueTokens(merchantId);
  }

  async logout(merchantId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      const key = await this.findRefreshKey(tokenHash);
      if (key) await this.redis.del(key);
    } else {
      const keys = await this.redis.keys(`velo:refresh:${merchantId}:*`);
      if (keys.length) await this.redis.del(...keys);
    }
  }

  async createApiKey(merchantId: string, name: string) {
    const plaintext = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = plaintext.slice(0, 16);
    const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex');
    await this.db.query(
      'INSERT INTO api_keys (merchant_id, key_hash, prefix, name) VALUES ($1, $2, $3, $4)',
      [merchantId, keyHash, prefix, name],
    );
    return { key: plaintext, prefix, name };
  }

  async listApiKeys(merchantId: string) {
    const { rows } = await this.db.query(
      'SELECT id, prefix, name, last_used_at, created_at FROM api_keys WHERE merchant_id = $1 AND is_active = true ORDER BY created_at DESC',
      [merchantId],
    );
    return rows;
  }

  async revokeApiKey(merchantId: string, keyId: string) {
    await this.db.query(
      'UPDATE api_keys SET is_active = false WHERE id = $1 AND merchant_id = $2',
      [keyId, merchantId],
    );
  }

  async validateApiKey(rawKey: string) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const { rows: [key] } = await this.db.query(
      'SELECT merchant_id FROM api_keys WHERE key_hash = $1 AND is_active = true',
      [keyHash],
    );
    if (!key) return null;
    await this.db.query('UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1', [keyHash]);
    const { rows: [merchant] } = await this.db.query(
      'SELECT id, email, name, tier, status FROM merchants WHERE id = $1 AND status = $2',
      [key.merchant_id, 'active'],
    );
    return merchant ?? null;
  }

  private async issueTokens(merchantId: string) {
    const accessToken = this.jwt.sign({ sub: merchantId });
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const tokenId = crypto.randomUUID();
    const ttl = 7 * 24 * 60 * 60;
    await this.redis.set(`velo:refresh:${merchantId}:${tokenId}`, tokenHash, 'EX', ttl);
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async findRefreshKey(tokenHash: string): Promise<string | null> {
    const keys = await this.redis.keys('velo:refresh:*');
    for (const key of keys) {
      const stored = await this.redis.get(key);
      if (stored === tokenHash) return key;
    }
    return null;
  }
}
