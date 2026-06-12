import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { CurrentMerchant } from './current-merchant.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto.email, dto.password, dto.name);
    this.setRefreshCookie(res, result.refresh_token);
    return { access_token: result.access_token, merchant: result.merchant };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(res, result.refresh_token);
    return { access_token: result.access_token, merchant: result.merchant };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['velo_refresh'];
    if (!token) throw new Error('Missing refresh token');
    const result = await this.auth.refresh(token);
    this.setRefreshCookie(res, result.refresh_token);
    return { access_token: result.access_token };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentMerchant() merchant: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.['velo_refresh'];
    await this.auth.logout(merchant.id, token);
    res.clearCookie('velo_refresh');
  }

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  async createApiKey(@CurrentMerchant() merchant: any, @Body() dto: CreateApiKeyDto) {
    return this.auth.createApiKey(merchant.id, dto.name);
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  async listApiKeys(@CurrentMerchant() merchant: any) {
    return this.auth.listApiKeys(merchant.id);
  }

  @Delete('api-keys/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async revokeApiKey(@CurrentMerchant() merchant: any, @Param('id') id: string) {
    await this.auth.revokeApiKey(merchant.id, id);
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('velo_refresh', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
