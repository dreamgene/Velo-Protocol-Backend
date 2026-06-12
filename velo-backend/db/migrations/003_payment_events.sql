CREATE TABLE payment_events (
  id BIGSERIAL PRIMARY KEY,
  paging_token TEXT UNIQUE NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  payer_address TEXT NOT NULL,
  stellar_tx_hash TEXT NOT NULL,
  amount_usdc NUMERIC(18, 7) NOT NULL,
  ledger_sequence BIGINT,
  ofac_result TEXT DEFAULT 'pass' CHECK (ofac_result IN ('pass', 'flag', 'block', 'skip')),
  matched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payment_events_invoice ON payment_events(invoice_id);
CREATE INDEX idx_payment_events_payer ON payment_events(payer_address);
CREATE INDEX idx_payment_events_tx_hash ON payment_events(stellar_tx_hash);
