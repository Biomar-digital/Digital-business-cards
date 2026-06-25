import { unifiedGroup } from './groups.js'

// Gestión de la imagen ("hero") del wallet pass, por scope.
// Prioridad al resolver para una persona: persona → grupo → default global.
//
//  settings:
//    hero:all            -> imagen por defecto para todos
//    hero:group:<group>  -> imagen para un grupo unificado
//  contacts.hero_image   -> imagen específica de la persona

const KEY_ALL = 'hero:all'
const keyGroup = (g) => `hero:group:${g}`

export async function getSetting(DB, key) {
  const row = await DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first()
  return row?.value ?? null
}

export async function setSetting(DB, key, value) {
  await DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) " +
    "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')",
  ).bind(key, value ?? null).run()
  return { ok: true }
}

/** Imagen de pase resuelta para un contacto (persona → grupo → default). */
export async function resolveHero(DB, contact) {
  if (contact.hero_image) return contact.hero_image
  const group = unifiedGroup(contact)
  const g = group ? await getSetting(DB, keyGroup(group)) : null
  if (g) return g
  return await getSetting(DB, KEY_ALL)
}

/** Estado actual: default + imagen por cada grupo presente. */
export async function listHeroSettings(DB) {
  const { results } = await DB.prepare("SELECT key, value FROM settings WHERE key LIKE 'hero:%'").all()
  const map = Object.fromEntries((results || []).map((r) => [r.key, r.value]))
  // Grupos presentes en los contactos.
  const { results: rows } = await DB.prepare('SELECT DISTINCT company, folder_name FROM contacts').all()
  const groups = new Set()
  for (const r of rows || []) { const gName = unifiedGroup(r); if (gName && gName !== '—') groups.add(gName) }
  return {
    default: map[KEY_ALL] || null,
    groups: [...groups].sort((a, b) => a.localeCompare(b)).map((g) => ({ group: g, image: map[keyGroup(g)] || null })),
  }
}

/** Guarda la imagen para el scope indicado (sin re-pushear todavía). */
export async function setHero(DB, { scope, group, qrId, qrIds, image }) {
  const img = image ? String(image).trim() : null
  if (scope === 'all') return setSetting(DB, KEY_ALL, img)
  if (scope === 'group') return setSetting(DB, keyGroup(group), img)
  if (scope === 'person') {
    await DB.prepare('UPDATE contacts SET hero_image=? WHERE qr_id=?').bind(img, String(qrId)).run()
    return { ok: true }
  }
  if (scope === 'selection') {
    const ids = (qrIds || []).map(String)
    for (const id of ids) {
      await DB.prepare('UPDATE contacts SET hero_image=? WHERE qr_id=?').bind(img, id).run()
    }
    return { ok: true, count: ids.length }
  }
  return { ok: false, error: 'scope inválido' }
}

/** Contactos CON pase afectados por un scope (para re-pushear). */
export async function affectedContacts(DB, { scope, group, qrId, qrIds }) {
  if (scope === 'person') {
    const c = await DB.prepare('SELECT * FROM contacts WHERE qr_id=? AND pass_id IS NOT NULL').bind(String(qrId)).first()
    return c ? [c] : []
  }
  if (scope === 'selection') {
    const ids = (qrIds || []).map(String)
    if (!ids.length) return []
    const ph = ids.map(() => '?').join(',')
    const { results } = await DB.prepare(`SELECT * FROM contacts WHERE pass_id IS NOT NULL AND qr_id IN (${ph})`).bind(...ids).all()
    return results || []
  }
  const { results } = await DB.prepare('SELECT * FROM contacts WHERE pass_id IS NOT NULL').all()
  const list = results || []
  if (scope === 'group') return list.filter((c) => unifiedGroup(c) === group)
  return list // all
}
