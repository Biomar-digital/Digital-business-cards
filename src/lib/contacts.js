import { createPassForContact, getTemplateDesign } from './providers/addToWallet.js'
import { getVcardLanding, listQrCodes } from './providers/qrCode.js'

// Directorio de personas: contactos extraídos de las vCards de qr-code-generator,
// cacheados en D1. Dos fases para escalar a cientos sin agotar subrequests:
//  1) indexPeople: lista TODOS los QR vCard una vez y crea filas base.
//  2) syncBatch: baja la landing de un lote de filas sin datos y las completa.

export async function listContacts(DB) {
  const { results } = await DB.prepare(
    'SELECT * FROM contacts ORDER BY company COLLATE NOCASE, full_name COLLATE NOCASE',
  ).all()
  return results
}

const insertBase = `
  INSERT INTO contacts (qr_id, short_code, short_url, full_name, folder_id, folder_name,
    total_scans, unique_scans, created_at)
  VALUES (?,?,?,?,?,?,?,?,?)
  ON CONFLICT(qr_id) DO UPDATE SET
    short_url=excluded.short_url, folder_id=excluded.folder_id, folder_name=excluded.folder_name,
    total_scans=excluded.total_scans, unique_scans=excluded.unique_scans
`

/** Fase 1: lista todas las vCards y crea/actualiza filas base (sin landing). */
export async function indexPeople(cfg, DB) {
  const people = (await listQrCodes(cfg)).filter((x) => x.isPerson && x.shortUrl)
  for (const qr of people) {
    await DB.prepare(insertBase)
      .bind(
        String(qr.id),
        qr.shortUrl ? qr.shortUrl.split('/').pop() : null,
        qr.shortUrl,
        qr.name || null,
        qr.folder != null ? String(qr.folder) : null,
        qr.folderName || null,
        qr.scans ?? 0,
        qr.uniqueScans ?? 0,
        qr.createdAt || null,
      )
      .run()
  }
  const { results } = await DB.prepare('SELECT COUNT(*) AS n FROM contacts WHERE synced_at IS NULL').all()
  return { indexed: people.length, pending: results[0]?.n ?? 0 }
}

const updateContact = `
  UPDATE contacts SET full_name=?, first_name=?, last_name=?, company=?, job=?, email=?,
    mobile=?, phone=?, website=?, city=?, country=?, synced_at=datetime('now')
  WHERE qr_id=?
`

/** Fase 2: baja la landing de hasta `limit` filas pendientes y las completa. */
export async function syncBatch(cfg, DB, { limit = 40 } = {}) {
  const { results: rows } = await DB.prepare(
    'SELECT qr_id, short_url, full_name FROM contacts WHERE synced_at IS NULL LIMIT ?',
  )
    .bind(limit)
    .all()

  let synced = 0
  for (const row of rows) {
    try {
      const c = await getVcardLanding(cfg, row.short_url)
      await DB.prepare(updateContact)
        .bind(
          c.fullName || row.full_name || null,
          c.firstName, c.lastName, c.company, c.job, c.email, c.mobile, c.phone,
          c.website, c.city, c.country,
          String(row.qr_id),
        )
        .run()
      synced++
    } catch {
      // si una landing falla, la marcamos igual para no reintentar en bucle
      await DB.prepare("UPDATE contacts SET synced_at=datetime('now') WHERE qr_id=?")
        .bind(String(row.qr_id))
        .run()
    }
  }

  const { results } = await DB.prepare('SELECT COUNT(*) AS n FROM contacts WHERE synced_at IS NULL').all()
  return { synced, remaining: results[0]?.n ?? 0 }
}

/** Marca todo para re-sincronizar (vuelve a bajar las landings). */
export async function resetSync(DB) {
  await DB.prepare('UPDATE contacts SET synced_at=NULL').run()
  return { ok: true }
}

/**
 * Crea wallet passes en lote para las personas indicadas (qrIds) que aún no
 * tienen pase. Cada pase lleva el barcode apuntando al vCard QR de la persona.
 * Procesa hasta `limit` por llamada (tope de subrequests del Worker).
 */
export async function createPassesBatch(cfg, DB, qrIds, { limit = 25 } = {}) {
  if (!Array.isArray(qrIds) || qrIds.length === 0) return { created: 0, remaining: 0, errors: [] }
  const ids = qrIds.map(String)
  const ph = ids.map(() => '?').join(',')

  const { results: rows } = await DB.prepare(
    `SELECT * FROM contacts WHERE qr_id IN (${ph}) AND pass_id IS NULL LIMIT ?`,
  )
    .bind(...ids, limit)
    .all()

  const design = await getTemplateDesign(cfg)
  let created = 0
  const errors = []
  for (const c of rows) {
    try {
      const r = await createPassForContact(cfg, c, design)
      await DB.prepare("UPDATE contacts SET pass_id=?, pass_url=?, pass_synced_at=datetime('now') WHERE qr_id=?")
        .bind(r.passId, r.passUrl, String(c.qr_id))
        .run()
      created++
    } catch (e) {
      errors.push({ name: c.full_name, error: String(e.message ?? e).slice(0, 200) })
    }
  }

  const { results: rem } = await DB.prepare(
    `SELECT COUNT(*) AS n FROM contacts WHERE qr_id IN (${ph}) AND pass_id IS NULL`,
  )
    .bind(...ids)
    .all()
  return { created, remaining: rem[0]?.n ?? 0, errors: errors.slice(0, 5) }
}
