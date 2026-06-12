CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard', 'pro', 'enterprise')),
  fee_bps INT NOT NULL DEFAULT 50,
  fee_fixed_usdc NUMERIC(18, 7) NOT NULL DEFAULT 0.25,
  muxed_base_id BIGINT UNIQUE,
  stellar_address TEXT,
  settlement_cadence TEXT DEFAULT 'daily',
  kyb_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_merchants_email ON merchants(email);
CREATE INDEX idx_merchants_status ON merchants(status);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE SEQUENCE muxed_id_seq START 1000000;

CREATE OR REPLACE FUNCTION claim_muxed_base_id(merchant_id UUID)
RETURNS BIGINT AS $$
DECLARE
  new_id BIGINT;
BEGIN
  new_id := nextval('muxed_id_seq');
  UPDATE merchants SET muxed_base_id = new_id WHERE id = merchant_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;
