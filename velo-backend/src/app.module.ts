import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { MerchantsModule } from './merchants/merchants.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { ComplianceModule } from './compliance/compliance.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SettlementModule } from './settlement/settlement.module';
import { StellarModule } from './stellar/stellar.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    MerchantsModule,
    InvoicesModule,
    PaymentsModule,
    ComplianceModule,
    WebhooksModule,
    SettlementModule,
    StellarModule,
    EmailModule,
  ],
})
export class AppModule {}
