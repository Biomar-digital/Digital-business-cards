-- Esquema de la base de datos D1 (SQLite de Cloudflare).
-- Aplícalo con:
--   wrangler d1 execute dbc --local  --file=./schema.sql   (desarrollo)
--   wrangler d1 execute dbc --remote --file=./schema.sql   (producción)

CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cards (
  id            TEXT PRIMARY KEY,
  group_id      TEXT REFERENCES groups(id) ON DELETE SET NULL,
  full_name     TEXT NOT NULL,
  job_title     TEXT,
  company       TEXT,
  email         TEXT,
  phone         TEXT,
  website       TEXT,
  notes         TEXT,

  -- AddToWallet
  pass_id       TEXT,
  pass_url      TEXT,

  -- qr-code-generator (qrco.de)
  qr_id         TEXT,
  qr_short_url  TEXT,
  qr_image_url  TEXT,

  status        TEXT NOT NULL DEFAULT 'draft', -- draft | active | error
  last_error    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS send_logs (
  id          TEXT PRIMARY KEY,
  card_id     TEXT REFERENCES cards(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,   -- email
  to_address  TEXT,
  status      TEXT NOT NULL,   -- sent | error
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cards_group ON cards(group_id);
CREATE INDEX IF NOT EXISTS idx_logs_card ON send_logs(card_id);
