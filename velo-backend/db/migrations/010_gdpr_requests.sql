CREATE TYPE gdpr_request_type AS ENUM ('export', 'erasure');
CREATE TYPE gdpr_request_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE gdpr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  type gdpr_request_type NOT NULL,
  status gdpr_request_status NOT NULL DEFAULT 'pending',
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gdpr_merchant ON gdpr_requests(merchant_id);

CREATE TRIGGER gdpr_updated_at
  BEFORE UPDATE ON gdpr_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
