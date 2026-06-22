import { getVcardLanding, listQrCodes } from './providers/qrCode.js'

// Directorio de personas: contactos extraídos de las vCards de qr-code-generator,
// cacheados en D1. Se sincroniza bajo demanda para no inflar los scans.

export async function listContacts(DB) {
  const { results } = await DB.prepare(
    'SELECT * FROM contacts ORDER BY company COLLATE NOCASE, full_name COLLATE NOCASE',
  ).all()
  return results
}

const upsert = `
  INSERT INTO contacts (qr_id, short_code, short_url, full_name, first_name, last_name,
    company, job, email, mobile, phone, website, city, country, folder_id, folder_name,
    total_scans, unique_scans, created_at, synced_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
  ON CONFLICT(qr_id) DO UPDATE SET
    full_name=excluded.full_name, first_name=excluded.first_name, last_name=excluded.last_name,
    company=excluded.company, job=excluded.job, email=excluded.email, mobile=excluded.mobile,
    phone=excluded.phone, website=excluded.website, city=excluded.city, country=excluded.country,
    folder_id=excluded.folder_id, folder_name=excluded.folder_name,
    total_scans=excluded.total_scans, unique_scans=excluded.unique_scans, synced_at=datetime('now')
`

/**
 * Sincroniza contactos: por cada vCard que aún no está cacheada (o todas si
 * force), pide la landing, parsea el contacto y lo guarda. Limita el lote para
 * no superar el tope de subrequests del Worker.
 */
export async function syncContacts(cfg, DB, { limit = 40, force = false } = {}) {
  const people = (await listQrCodes(cfg)).filter((x) => x.isPerson && x.shortUrl)
  const { results } = await DB.prepare('SELECT qr_id FROM contacts').all()
  const have = new Set(results.map((r) => String(r.qr_id)))

  const todo = people.filter((x) => force || !have.has(String(x.id))).slice(0, limit)
  let synced = 0
  for (const qr of todo) {
    try {
      const c = await getVcardLanding(cfg, qr.shortUrl)
      await DB.prepare(upsert)
        .bind(
          String(qr.id),
          qr.shortUrl ? qr.shortUrl.split('/').pop() : null,
          qr.shortUrl,
          c.fullName || qr.name || null,
          c.firstName, c.lastName, c.company, c.job, c.email, c.mobile, c.phone,
          c.website, c.city, c.country,
          qr.folder != null ? String(qr.folder) : null,
          qr.folderName || null,
          qr.scans ?? 0,
          qr.uniqueScans ?? 0,
          qr.createdAt || null,
        )
        .run()
      synced++
    } catch {
      // si una landing falla, seguimos con las demás
    }
  }

  const cachedNow = have.size + (force ? 0 : synced)
  return {
    synced,
    totalPeople: people.length,
    remaining: Math.max(0, people.length - cachedNow),
  }
}
