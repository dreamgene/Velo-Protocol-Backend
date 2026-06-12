import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SettlementService } from './settlement.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentMerchant } from '../auth/current-merchant.decorator';

@Controller('settlements')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class SettlementController {
  constructor(private readonly settlement: SettlementService) {}

  @Get()
  list(@CurrentMerchant() merchant: any) {
    return this.settlement.getSettlements(merchant.id);
  }
}
