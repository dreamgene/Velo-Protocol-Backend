import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly auth: AuthService) {
    super();
  }

  async validate(req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException();
    const key = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!key.startsWith('sk_live_') && !key.startsWith('sk_test_')) {
      throw new UnauthorizedException();
    }
    const merchant = await this.auth.validateApiKey(key);
    if (!merchant) throw new UnauthorizedException('Invalid API key');
    return merchant;
  }
}
