import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';
import { ApiKeyOrJwtGuard } from '../auth/api-key.guard';
import { CurrentMerchant } from '../auth/current-merchant.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@Controller('webhooks')
@UseGuards(ApiKeyOrJwtGuard)
@SkipThrottle()
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  create(@CurrentMerchant() merchant: any, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(merchant.id, dto.url, dto.events);
  }

  @Get()
  list(@CurrentMerchant() merchant: any) {
    return this.webhooks.list(merchant.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentMerchant() merchant: any, @Param('id') id: string) {
    return this.webhooks.delete(merchant.id, id);
  }

  @Get(':id/deliveries')
  deliveries(@CurrentMerchant() merchant: any, @Param('id') id: string) {
    return this.webhooks.getDeliveries(merchant.id, id);
  }
}
