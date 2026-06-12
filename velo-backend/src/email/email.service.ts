import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type EmailTemplate =
  | 'welcome'
  | 'invoice_paid'
  | 'settlement_completed'
  | 'webhook_failure'
  | 'api_key_created'
  | 'password_reset'
  | 'gdpr_export_ready';

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {}

  async sendEmail(to: string, template: EmailTemplate, model: Record<string, any>) {
    const apiToken = this.config.get<string>('POSTMARK_API_TOKEN');
    if (!apiToken) {
      console.log(`[email] Would send "${template}" to ${to}`, model);
      return;
    }

    const response = await fetch('https://api.postmarkapp.com/email/withTemplate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiToken,
      },
      body: JSON.stringify({
        From: 'hello@velo.finance',
        To: to,
        TemplateAlias: template,
        TemplateModel: model,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to send email "${template}" to ${to}:`, await response.text());
    }
  }

  sendWelcome(to: string, name: string) {
    return this.sendEmail(to, 'welcome', { name, app_url: this.config.get('APP_URL') });
  }

  sendInvoicePaid(to: string, data: { invoice_id: string; amount: string; payer: string; tx_hash: string }) {
    return this.sendEmail(to, 'invoice_paid', data);
  }

  sendSettlementCompleted(to: string, data: { amount: string; destination: string; tx_hash: string }) {
    return this.sendEmail(to, 'settlement_completed', data);
  }

  sendWebhookFailure(to: string, data: { endpoint: string; event_type: string; attempt: number; next_retry: string }) {
    return this.sendEmail(to, 'webhook_failure', data);
  }

  sendApiKeyCreated(to: string, data: { prefix: string; created_at: string }) {
    return this.sendEmail(to, 'api_key_created', data);
  }
}
