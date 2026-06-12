ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_isolation_invoices ON invoices
  USING (merchant_id::text = current_setting('app.current_merchant_id', true));

CREATE POLICY merchant_isolation_ledger ON ledger_entries
  USING (merchant_id::text = current_setting('app.current_merchant_id', true));

CREATE POLICY merchant_isolation_webhooks ON webhooks
  USING (merchant_id::text = current_setting('app.current_merchant_id', true));

CREATE POLICY merchant_isolation_webhook_deliveries ON webhook_deliveries
  USING (
    webhook_id IN (
      SELECT id FROM webhooks
      WHERE merchant_id::text = current_setting('app.current_merchant_id', true)
    )
  );

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'velo_app') THEN
    CREATE ROLE velo_app LOGIN PASSWORD 'change_in_production';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO velo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO velo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO velo_app;
