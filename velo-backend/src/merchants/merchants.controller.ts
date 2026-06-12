import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { MerchantsService } from './merchants.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentMerchant } from '../auth/current-merchant.decorator';

@Controller('merchants')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Get('me')
  profile(@CurrentMerchant() merchant: any) {
    return this.merchants.getProfile(merchant.id);
  }

  @Patch('me')
  update(@CurrentMerchant() merchant: any, @Body() body: { name?: string; stellar_address?: string }) {
    return this.merchants.updateProfile(merchant.id, body);
  }

  @Get('me/stats')
  stats(@CurrentMerchant() merchant: any) {
    return this.merchants.getDashboardStats(merchant.id);
  }
}
