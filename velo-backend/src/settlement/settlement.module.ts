import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [ScheduleModule.forRoot(), StellarModule],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
