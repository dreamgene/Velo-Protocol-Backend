CREATE SEQUENCE invoice_seq START 1;

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  amount_usdc NUMERIC(18, 7) NOT NULL CHECK (amount_usdc > 0),
  gross_usdc NUMERIC(18, 7) NOT NULL,
  fee_usdc NUMERIC(18, 7) NOT NULL,
  net_usdc NUMERIC(18, 7) NOT NULL,
  muxed_id BIGINT UNIQUE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoices_merchant_status ON invoices(merchant_id, status);
CREATE INDEX idx_invoices_muxed_id ON invoices(muxed_id);
CREATE INDEX idx_invoices_pending ON invoices(expires_at) WHERE status = 'pending';
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC, id DESC);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION claim_invoice_seq()
RETURNS BIGINT AS $$
BEGIN
  RETURN nextval('invoice_seq');
END;
$$ LANGUAGE plpgsql;
