export type InvoiceStatus = 'pending' | 'paid' | 'expired' | 'cancelled';
export type WebhookStatus = 'active' | 'inactive';

export interface Invoice {
  id: string;
  merchant_id: string;
  muxed_address: string;
  gross_amount: string;
  fee_amount: string;
  net_amount: string;
  currency: string;
  status: InvoiceStatus;
  description?: string;
  metadata?: Record<string, unknown>;
  expires_at?: string;
  paid_at?: string;
  tx_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceParams {
  amount: number;
  currency?: string;
  description?: string;
  expires_in_hours?: number;
  metadata?: Record<string, unknown>;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface CreateWebhookParams {
  url: string;
  events: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
}

export interface VeloClientOptions {
  apiKey: string;
  baseUrl?: string;
}
