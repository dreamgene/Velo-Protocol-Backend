import type {
  Invoice,
  CreateInvoiceParams,
  Webhook,
  CreateWebhookParams,
  PaginatedResponse,
  VeloClientOptions,
} from './types';

export * from './types';

const DEFAULT_BASE_URL = 'https://api.velo.finance';

class VeloError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'VeloError';
  }
}

async function request<T>(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': '@velo-protocol/pay/0.1.0',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new VeloError(err.message ?? res.statusText, res.status, err.code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

class InvoicesResource {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  create(params: CreateInvoiceParams): Promise<Invoice> {
    return request<Invoice>(this.baseUrl, this.apiKey, 'POST', '/invoices', {
      ...params,
      currency: params.currency ?? 'USDC',
    });
  }

  get(id: string): Promise<Invoice> {
    return request<Invoice>(this.baseUrl, this.apiKey, 'GET', `/invoices/${id}`);
  }

  list(cursor?: string): Promise<PaginatedResponse<Invoice>> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request<PaginatedResponse<Invoice>>(
      this.baseUrl,
      this.apiKey,
      'GET',
      `/invoices${qs}`,
    );
  }

  cancel(id: string): Promise<Invoice> {
    return request<Invoice>(this.baseUrl, this.apiKey, 'PATCH', `/invoices/${id}/cancel`);
  }
}

class WebhooksResource {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  create(params: CreateWebhookParams): Promise<Webhook & { secret: string }> {
    return request<Webhook & { secret: string }>(
      this.baseUrl,
      this.apiKey,
      'POST',
      '/webhooks',
      params,
    );
  }

  list(cursor?: string): Promise<PaginatedResponse<Webhook>> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request<PaginatedResponse<Webhook>>(
      this.baseUrl,
      this.apiKey,
      'GET',
      `/webhooks${qs}`,
    );
  }

  delete(id: string): Promise<void> {
    return request<void>(this.baseUrl, this.apiKey, 'DELETE', `/webhooks/${id}`);
  }

  /**
   * Verify a webhook payload signature.
   * Returns true if HMAC-SHA256 of raw body matches the Velo-Signature header.
   */
  async verify(rawBody: string, signature: string, secret: string): Promise<boolean> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return expected === signature;
  }
}

export class VeloClient {
  readonly invoices: InvoicesResource;
  readonly webhooks: WebhooksResource;

  constructor(options: VeloClientOptions) {
    const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.invoices = new InvoicesResource(baseUrl, options.apiKey);
    this.webhooks = new WebhooksResource(baseUrl, options.apiKey);
  }
}
