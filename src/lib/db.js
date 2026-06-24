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
  // Contactos extraídos de las vCards de qr-code-generator (cacheados para no
  // pedir la landing en cada carga e inflar los scans).
  `CREATE TABLE IF NOT EXISTS contacts (
    qr_id        TEXT PRIMARY KEY,
    short_code   TEXT,
    short_url    TEXT,
    full_name    TEXT,
    first_name   TEXT,
    last_name    TEXT,
    company      TEXT,
    job          TEXT,
    email        TEXT,
    mobile       TEXT,
    phone        TEXT,
    website      TEXT,
    city         TEXT,
    country      TEXT,
    folder_id    TEXT,
    folder_name  TEXT,
    total_scans  INTEGER,
    unique_scans INTEGER,
    created_at   TEXT,
    synced_at    TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company)`,
  `CREATE TABLE IF NOT EXISTS change_requests (
    id          TEXT PRIMARY KEY,
    qr_id       TEXT,
    full_name   TEXT,
    company     TEXT,
    job         TEXT,
    email       TEXT,
    phone       TEXT,
    message     TEXT,
    status      TEXT NOT NULL DEFAULT 'open',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
]

// Columnas añadidas después (ALTER no es idempotente: se ignora si ya existe).
const ALTERS = [
  'ALTER TABLE contacts ADD COLUMN pass_id TEXT',
  'ALTER TABLE contacts ADD COLUMN pass_url TEXT',
  'ALTER TABLE contacts ADD COLUMN pass_synced_at TEXT',
  'ALTER TABLE contacts ADD COLUMN intro_email_at TEXT',
  // Solicitudes: distinguir "cambio" (change) de "nueva tarjeta" (new) + país.
  "ALTER TABLE change_requests ADD COLUMN kind TEXT NOT NULL DEFAULT 'change'",
  'ALTER TABLE change_requests ADD COLUMN country TEXT',
]

export async function ensureSchema(DB) {
  if (ready || !DB) return
  await DB.batch(STATEMENTS.map((sql) => DB.prepare(sql)))
  for (const sql of ALTERS) {
    try { await DB.prepare(sql).run() } catch { /* la columna ya existe */ }
  }
  ready = true
}
