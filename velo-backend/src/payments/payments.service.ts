import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as StellarSdk from '@stellar/stellar-sdk';
import { DATABASE_POOL } from '../database/database.module';
import { REDIS_CLIENT } from '../redis/redis.module';
import { StellarService } from '../stellar/stellar.service';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DATABASE_POOL) private readonly db: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly stellar: StellarService,
  ) {}

  async prepareTransaction(invoiceId: string, payerPublicKey: string): Promise<{ xdr: string; network_passphrase: string }> {
    const { rows: [invoice] } = await this.db.query(
      `SELECT i.*, m.muxed_base_id, m.stellar_address
       FROM invoices i JOIN merchants m ON m.id = i.merchant_id
       WHERE i.id = $1 AND i.status = 'pending'`,
      [invoiceId],
    );
    if (!invoice) throw new NotFoundException('Invoice not found or not pending');

    const network = this.config.get<string>('STELLAR_NETWORK') === 'mainnet'
      ? StellarSdk.Networks.PUBLIC
      : StellarSdk.Networks.TESTNET;
    const horizonUrl = this.config.get<string>('STELLAR_HORIZON_URL')!;
    const server = new StellarSdk.Horizon.Server(horizonUrl);

    const payerAccount = await server.loadAccount(payerPublicKey);

    const muxed = new StellarSdk.MuxedAccount(
      new StellarSdk.Account(this.config.get<string>('STELLAR_TREASURY_PUBLIC_KEY')!, '0'),
      (BigInt(invoice.muxed_base_id) * BigInt(1_000_000) + BigInt(invoice.muxed_id)).toString(),
    );

    const usdcAsset = new StellarSdk.Asset(
      this.config.get<string>('USDC_ASSET_CODE')!,
      this.config.get<string>('USDC_ASSET_ISSUER')!,
    );

    const tx = new StellarSdk.TransactionBuilder(payerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: network,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: muxed.accountId(),
          asset: usdcAsset,
          amount: invoice.gross_usdc,
        }),
      )
      .setTimeout(300)
      .build();

    return { xdr: tx.toXDR(), network_passphrase: network };
  }

  async submitSigned(invoiceId: string, signedXdr: string): Promise<{ tx_hash: string }> {
    const { rows: [invoice] } = await this.db.query(
      `SELECT status FROM invoices WHERE id = $1`,
      [invoiceId],
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'pending') {
      throw new BadRequestException(`Invoice is ${invoice.status}, not pending`);
    }

    const result = await this.stellar.submitTransaction(signedXdr);
    return { tx_hash: result.hash };
  }

  async subscribeToStatus(invoiceId: string, res: any) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const { rows: [invoice] } = await this.db.query(
      'SELECT status FROM invoices WHERE id = $1',
      [invoiceId],
    );
    if (invoice?.status === 'paid') {
      sendEvent({ status: 'paid' });
      res.end();
      return;
    }

    sendEvent({ status: 'pending' });

    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(`velo:invoice:${invoiceId}`);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    subscriber.on('message', (_channel: string, message: string) => {
      sendEvent(JSON.parse(message));
      cleanup();
    });

    const cleanup = () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe();
      subscriber.disconnect();
      res.end();
    };

    res.on('close', cleanup);
  }
}
