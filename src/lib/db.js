// Crea el esquema en D1 la primera vez que el Worker lo necesita, así no hay
// que cargar schema.sql a mano. `CREATE TABLE IF NOT EXISTS` es idempotente y
// el flag en memoria evita repetirlo en cada petición del mismo isolate.

let ready = false

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS groups (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    id            TEXT PRIMARY KEY,
    group_id      TEXT REFERENCES groups(id) ON DELETE SET NULL,
    full_name     TEXT NOT NULL,
    job_title     TEXT,
    company       TEXT,
    email         TEXT,
    phone         TEXT,
    website       TEXT,
    notes         TEXT,
    pass_id       TEXT,
    pass_url      TEXT,
    qr_id         TEXT,
    qr_short_url  TEXT,
    qr_image_url  TEXT,
    status        TEXT NOT NULL DEFAULT 'draft',
    last_error    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS send_logs (
    id          TEXT PRIMARY KEY,
    card_id     TEXT REFERENCES cards(id) ON DELETE CASCADE,
    channel     TEXT NOT NULL,
    to_address  TEXT,
    status      TEXT NOT NULL,
    error       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cards_group ON cards(group_id)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_card ON send_logs(card_id)`,
]

export async function ensureSchema(DB) {
  if (ready || !DB) return
  await DB.batch(STATEMENTS.map((sql) => DB.prepare(sql)))
  ready = true
}
