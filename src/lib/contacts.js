import { createPassForContact, getTemplateDesign, listPasses, updatePassForContact } from './providers/addToWallet.js'
import { sendIntroEmail } from './email.js'
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

// Campos del contacto editables desde el panel.
const EDITABLE = ['full_name', 'first_name', 'last_name', 'company', 'job', 'email', 'mobile', 'phone', 'website', 'city', 'country']

/**
 * Edita los datos de una persona en el directorio y, si ya tiene pase, empuja
 * la actualización al wallet pass (AddToWallet). Devuelve el resultado del
 * update del pase para poder confirmar que la API respondió OK.
 */
export async function updatePerson(cfg, DB, qrId, fields = {}) {
  const sets = []
  const vals = []
  for (const k of EDITABLE) {
    if (k in fields) {
      sets.push(`${k}=?`)
      const v = fields[k]
      vals.push(v == null || v === '' ? null : String(v).slice(0, 200))
    }
  }
  if (sets.length === 0) return { ok: false, error: 'Sin cambios' }
  vals.push(String(qrId))
  await DB.prepare(`UPDATE contacts SET ${sets.join(', ')} WHERE qr_id=?`).bind(...vals).run()

  const contact = await DB.prepare('SELECT * FROM contacts WHERE qr_id=?').bind(String(qrId)).first()
  if (!contact) return { ok: false, error: 'No encontrada' }

  let pass = { skipped: true, reason: 'sin pase' }
  if (contact.pass_id) {
    const design = await getTemplateDesign(cfg)
    pass = await updatePassForContact(cfg, contact, design)
  }
  return { ok: true, contact, pass }
}

/** Marca todo para re-sincronizar (vuelve a bajar las landings). */
export async function resetSync(DB) {
  await DB.prepare('UPDATE contacts SET synced_at=NULL').run()
  return { ok: true }
}

// Normaliza una URL/short_url a su "código" final (qrco.de/<code> -> code).
function shortKey(u) {
  if (!u) return null
  const s = String(u).trim().toLowerCase().replace(/\/+$/, '')
  const seg = s.split('/').pop()
  return seg || null
}

/**
 * Vincula pases que YA existen en AddToWallet (creados fuera de este panel) con
 * las personas del directorio, rellenando pass_id/pass_url. Así aparecen en la
 * gestión, se les puede enviar el email y NO se les crea un pase duplicado.
 * Matchea por: código del QR (barcode = short_url), luego email, luego nombre.
 */
export async function linkExistingPasses(cfg, DB) {
  const passes = await listPasses(cfg)
  const { results: contacts } = await DB.prepare(
    'SELECT qr_id, short_url, short_code, email, full_name, pass_id FROM contacts',
  ).all()

  const byShort = new Map()
  const byEmail = new Map()
  const byName = new Map()
  for (const c of contacts) {
    const sk = c.short_code ? String(c.short_code).toLowerCase() : shortKey(c.short_url)
    if (sk) byShort.set(sk, c)
    if (c.email) byEmail.set(String(c.email).trim().toLowerCase(), c)
    if (c.full_name) byName.set(String(c.full_name).trim().toLowerCase(), c)
  }

  let linked = 0
  let already = 0
  const unmatched = []
  for (const p of passes) {
    if (!p.id) continue
    const x = p.raw || {}
    const barcode = x.barcodeValue ?? x.barcode?.value ?? x.barcode ?? x.qrValue ?? null

    let c = null
    if (barcode) c = byShort.get(shortKey(barcode))
    if (!c && p.email) c = byEmail.get(String(p.email).trim().toLowerCase())
    if (!c && p.name) c = byName.get(String(p.name).trim().toLowerCase())
    if (!c) { unmatched.push(p.name || p.email || p.id); continue }
    if (c.pass_id) { already++; continue }

    const passUrl = `https://app.addtowallet.co/card/${p.id}`
    await DB.prepare("UPDATE contacts SET pass_id=?, pass_url=?, pass_synced_at=datetime('now') WHERE qr_id=?")
      .bind(p.id, passUrl, String(c.qr_id))
      .run()
    linked++
  }
  return { passes: passes.length, linked, already, unmatched: unmatched.slice(0, 25) }
}

/**
 * Envía el email de introducción a las personas indicadas (qrIds) que ya tienen
 * pase (pass_url) y email. Sirve para enviar/reenviar por individuo o por grupo.
 * El front trocea la selección, así que aquí procesamos lo que llegue (un email
 * = un subrequest a Brevo). Marca intro_email_at en cada envío correcto.
 */
export async function sendIntroEmails(cfg, DB, qrIds) {
  if (!Array.isArray(qrIds) || qrIds.length === 0) return { sent: 0, skipped: 0, errors: [] }
  const ids = qrIds.map(String).slice(0, 40)
  const ph = ids.map(() => '?').join(',')
  const { results: rows } = await DB.prepare(
    `SELECT qr_id, full_name, email, pass_url FROM contacts WHERE qr_id IN (${ph})`,
  )
    .bind(...ids)
    .all()

  let sent = 0
  let skipped = 0
  const errors = []
  for (const c of rows) {
    if (!c.email || !c.pass_url) { skipped++; continue }
    try {
      await sendIntroEmail(cfg, { name: c.full_name, email: c.email, passUrl: c.pass_url, qrId: c.qr_id })
      await DB.prepare("UPDATE contacts SET intro_email_at=datetime('now') WHERE qr_id=?")
        .bind(String(c.qr_id))
        .run()
      sent++
    } catch (e) {
      errors.push({ name: c.full_name, error: String(e.message ?? e).slice(0, 160) })
    }
  }
  return { sent, skipped, errors: errors.slice(0, 5) }
}

/**
 * Crea wallet passes en lote para las personas indicadas (qrIds) que aún no
 * tienen pase. Cada pase lleva el barcode apuntando al vCard QR de la persona.
 * Procesa hasta `limit` por llamada (tope de subrequests del Worker).
 */
export async function createPassesBatch(cfg, DB, qrIds, { limit = 25, sendEmail = false } = {}) {
  if (!Array.isArray(qrIds) || qrIds.length === 0) return { created: 0, emailed: 0, remaining: 0, errors: [] }
  const ids = qrIds.map(String)
  const ph = ids.map(() => '?').join(',')

  const { results: rows } = await DB.prepare(
    `SELECT * FROM contacts WHERE qr_id IN (${ph}) AND pass_id IS NULL LIMIT ?`,
  )
    .bind(...ids, limit)
    .all()

  const design = await getTemplateDesign(cfg)
  let created = 0
  let emailed = 0
  const errors = []
  for (const c of rows) {
    try {
      const r = await createPassForContact(cfg, c, design)
      await DB.prepare("UPDATE contacts SET pass_id=?, pass_url=?, pass_synced_at=datetime('now') WHERE qr_id=?")
        .bind(r.passId, r.passUrl, String(c.qr_id))
        .run()
      created++
      if (sendEmail && c.email && r.passUrl) {
        try {
          await sendIntroEmail(cfg, { name: c.full_name, email: c.email, passUrl: r.passUrl, qrId: c.qr_id })
          emailed++
        } catch (e) {
          errors.push({ name: c.full_name, error: 'email: ' + String(e.message ?? e).slice(0, 160) })
        }
      }
    } catch (e) {
      errors.push({ name: c.full_name, error: String(e.message ?? e).slice(0, 200) })
    }
  }

  const { results: rem } = await DB.prepare(
    `SELECT COUNT(*) AS n FROM contacts WHERE qr_id IN (${ph}) AND pass_id IS NULL`,
  )
    .bind(...ids)
    .all()
  return { created, emailed, remaining: rem[0]?.n ?? 0, errors: errors.slice(0, 5) }
}
