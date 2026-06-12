CREATE TABLE ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  gross_usdc NUMERIC(18, 7) NOT NULL,
  fee_usdc NUMERIC(18, 7) NOT NULL,
  net_usdc NUMERIC(18, 7) NOT NULL,
  type TEXT NOT NULL DEFAULT 'payment' CHECK (type IN ('payment', 'refund', 'fee', 'settlement')),
  settlement_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ledger_entries_merchant ON ledger_entries(merchant_id);
CREATE INDEX idx_ledger_entries_unsettled ON ledger_entries(merchant_id) WHERE settlement_id IS NULL;
CREATE INDEX idx_ledger_entries_invoice ON ledger_entries(invoice_id);
