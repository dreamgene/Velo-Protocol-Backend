import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { IsString, IsNotEmpty } from 'class-validator';
import { PaymentsService } from './payments.service';

class SubmitTransactionDto {
  @IsString()
  @IsNotEmpty()
  xdr!: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':id/prepare-tx')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  prepareTx(@Param('id') id: string, @Query('payer') payer: string) {
    return this.payments.prepareTransaction(id, payer);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  submit(@Param('id') id: string, @Body() dto: SubmitTransactionDto) {
    return this.payments.submitSigned(id, dto.xdr);
  }

  @Get(':id/stream')
  stream(@Param('id') id: string, @Res() res: Response) {
    return this.payments.subscribeToStatus(id, res);
  }
}
