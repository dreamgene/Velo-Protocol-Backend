import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KMSClient, SignCommand, GetPublicKeyCommand } from '@aws-sdk/client-kms';

@Injectable()
export class KmsSignerService {
  private readonly kms: KMSClient;
  private readonly keyId: string;

  constructor(private readonly config: ConfigService) {
    this.kms = new KMSClient({ region: config.get<string>('AWS_REGION') });
    this.keyId = config.get<string>('AWS_KMS_KEY_ID') ?? '';
  }

  async sign(messageBytes: Buffer): Promise<Buffer> {
    if (!this.keyId) {
      throw new Error('AWS_KMS_KEY_ID not configured');
    }
    const command = new SignCommand({
      KeyId: this.keyId,
      Message: messageBytes,
      MessageType: 'RAW',
      SigningAlgorithm: 'ECDSA_SHA_256',
    });
    const response = await this.kms.send(command);
    return Buffer.from(response.Signature!);
  }

  async getPublicKey(): Promise<Buffer> {
    if (!this.keyId) {
      throw new Error('AWS_KMS_KEY_ID not configured');
    }
    const command = new GetPublicKeyCommand({ KeyId: this.keyId });
    const response = await this.kms.send(command);
    return Buffer.from(response.PublicKey!);
  }
}
