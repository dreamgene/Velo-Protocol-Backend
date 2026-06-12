import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(DATABASE_POOL) private readonly db: Pool,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string }) {
    const { rows: [merchant] } = await this.db.query(
      'SELECT id, email, name, tier, status FROM merchants WHERE id = $1',
      [payload.sub],
    );
    if (!merchant || merchant.status === 'suspended') {
      throw new UnauthorizedException();
    }
    return merchant;
  }
}
