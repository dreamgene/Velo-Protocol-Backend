import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InvoicesService } from './invoices.service';
import { ApiKeyOrJwtGuard } from '../auth/api-key.guard';
import { CurrentMerchant } from '../auth/current-merchant.decorator';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get('public/:id')
  findPublic(@Param('id') id: string) {
    return this.invoices.findPublic(id);
  }

  @Post()
  @UseGuards(ApiKeyOrJwtGuard)
  @SkipThrottle()
  create(@CurrentMerchant() merchant: any, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(merchant.id, dto.amount_usdc, dto.description, dto.expires_in_minutes);
  }

  @Get()
  @UseGuards(ApiKeyOrJwtGuard)
  @SkipThrottle()
  findMany(
    @CurrentMerchant() merchant: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.invoices.findMany(merchant.id, cursor, limit ? parseInt(limit) : 20, status);
  }

  @Get(':id')
  @UseGuards(ApiKeyOrJwtGuard)
  @SkipThrottle()
  findOne(@CurrentMerchant() merchant: any, @Param('id') id: string) {
    return this.invoices.findOne(id, merchant.id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(ApiKeyOrJwtGuard)
  @SkipThrottle()
  cancel(@CurrentMerchant() merchant: any, @Param('id') id: string) {
    return this.invoices.cancel(id, merchant.id);
  }
}
