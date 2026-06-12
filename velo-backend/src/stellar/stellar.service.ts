import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  private readonly server: StellarSdk.Horizon.Server;
  private readonly network: string;
  private readonly usdcAsset: StellarSdk.Asset;

  constructor(private readonly config: ConfigService) {
    this.server = new StellarSdk.Horizon.Server(config.get<string>('STELLAR_HORIZON_URL')!);
    this.network = config.get<string>('STELLAR_NETWORK') === 'mainnet'
      ? StellarSdk.Networks.PUBLIC
      : StellarSdk.Networks.TESTNET;
    this.usdcAsset = new StellarSdk.Asset(
      config.get<string>('USDC_ASSET_CODE')!,
      config.get<string>('USDC_ASSET_ISSUER')!,
    );
  }

  buildMuxedAddress(muxedBaseId: bigint, invoiceSeq: bigint): string {
    const treasuryKey = this.config.get<string>('STELLAR_TREASURY_PUBLIC_KEY')!;
    const muxed = new StellarSdk.MuxedAccount(
      new StellarSdk.Account(treasuryKey, '0'),
      (muxedBaseId * BigInt(1_000_000) + invoiceSeq).toString(),
    );
    return muxed.accountId();
  }

  async buildPaymentXdr(payerPublicKey: string, invoice: any): Promise<string> {
    const payerAccount = await this.server.loadAccount(payerPublicKey);
    const muxedAddress = this.buildMuxedAddress(
      BigInt(invoice.muxed_base_id),
      BigInt(invoice.muxed_id),
    );

    const tx = new StellarSdk.TransactionBuilder(payerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.network,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: muxedAddress,
          asset: this.usdcAsset,
          amount: invoice.gross_usdc,
        }),
      )
      .setTimeout(300)
      .build();

    return tx.toXDR();
  }

  async submitTransaction(signedXdrBase64: string): Promise<any> {
    const tx = new StellarSdk.Transaction(signedXdrBase64, this.network);
    return this.server.submitTransaction(tx);
  }

  async buildAndSubmitSettlementPayment(destination: string, amountUsdc: string): Promise<string> {
    const secretKey = this.config.get<string>('STELLAR_TREASURY_SECRET_KEY')!;
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const sourceAccount = await this.server.loadAccount(keypair.publicKey());

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.network,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination,
          asset: this.usdcAsset,
          amount: amountUsdc,
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const result = await this.server.submitTransaction(tx);
    return result.hash;
  }

  async getAccount(publicKey: string) {
    return this.server.loadAccount(publicKey);
  }
}
