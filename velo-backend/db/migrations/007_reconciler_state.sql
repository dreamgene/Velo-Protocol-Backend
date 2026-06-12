CREATE TABLE reconciler_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO reconciler_state (key, value) VALUES ('cursor', '');
