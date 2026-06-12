import { Module } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { KmsSignerService } from './kms-signer.service';

@Module({
  providers: [StellarService, KmsSignerService],
  exports: [StellarService, KmsSignerService],
})
export class StellarModule {}
