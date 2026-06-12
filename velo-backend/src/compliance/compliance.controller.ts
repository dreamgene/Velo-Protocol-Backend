import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ComplianceService } from './compliance.service';

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Post('screen')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  screen(@Body() body: { address: string; merchant_id?: string }) {
    return this.compliance.screen(body.address, body.merchant_id ?? 'anonymous');
  }
}
