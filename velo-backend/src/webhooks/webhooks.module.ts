import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookConsumer } from './webhook.consumer';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookConsumer],
  exports: [WebhooksService],
})
export class WebhooksModule {}
