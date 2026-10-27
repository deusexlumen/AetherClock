CREATE TABLE IF NOT EXISTS ai_request_budgets (
  bucket TEXT PRIMARY KEY NOT NULL,
  requests INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
