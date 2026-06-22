import { nanoid } from 'nanoid'

/**
 * Cliente de qr-code-generator (dominio corto qrco.de).
 *
 * Auth: la API documenta `access-token` como parámetro de query (no header).
 * Las rutas/campos exactos están tras Cloudflare; los puntos a confirmar con
 * tus docs están marcados con  // ⚙️ AJUSTAR. El listado mapea de forma
 * defensiva varios nombres de campo posibles y, si algo no encaja, usa el
 * endpoint /raw del panel para ver la respuesta real y afinar el mapeo.
 */

// ¿Podemos leer datos reales? Sí en cuanto haya API key (la lectura es de solo
// lectura y segura), aunque PROVIDER_MODE siga en mock.
function canReadLive(cfg) {
  return Boolean(cfg.qrCode.apiKey)
}

async function apiFetch(cfg, path, { method = 'GET', body } = {}) {
  const sep = path.includes('?') ? '&' : '?'
  // ⚙️ AJUSTAR: algunos planes aceptan también header Authorization
  const url = `${cfg.qrCode.baseUrl}${path}${sep}access-token=${encodeURIComponent(cfg.qrCode.apiKey)}`
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(`qr-code-generator ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  }
  return data
}

// Normaliza un QR de la API a la forma que usa el panel, probando varios
// nombres de campo habituales.
function normalizeQr(x) {
  const shortUrl = x.short_url ?? x.shortUrl ?? x.qrcode_url ?? x.qr_url ?? null
  return {
    id: x.id ?? x.qr_id ?? x.code_id ?? null,
    name: x.title || x.name || x.qr_code_name || '—',
    type: x.type_name ?? null,
    folder: x.folder_id ?? null,
    isPerson: x.type_id === 12 || /vcard/i.test(x.type_name || ''),
    scans: x.total_scans ?? x.number_of_scans ?? x.scans ?? 0,
    uniqueScans: x.unique_scans ?? null,
    shortUrl,
    targetUrl: x.target_url ?? x.targetUrl ?? x.url ?? null,
    imageUrl: x.image_url ?? x.qr_code ?? x.png ?? null,
    createdAt: x.created ?? x.created_at ?? x.createdAt ?? null,
    raw: x,
  }
}

function extractList(data) {
  if (Array.isArray(data)) return data
  return data.codes ?? data.data ?? data.items ?? data.results ?? data.qr_codes ?? []
}

/** Lista las carpetas (grupos) de la cuenta. Devuelve [{id, name}]. */
export async function listFolders(cfg) {
  if (!canReadLive(cfg)) return [{ id: 1, name: 'Default' }]
  try {
    const data = await apiFetch(cfg, '/folders')
    const list = Array.isArray(data) ? data : (data.folders ?? data.data ?? data.items ?? data.results ?? [])
    return list.map((f) => ({ id: f.id ?? f.folder_id ?? null, name: f.name ?? f.title ?? String(f.id ?? '') }))
  } catch {
    return []
  }
}

/** Lista TODOS los QR de la cuenta, con el nombre de su carpeta (grupo). */
export async function listQrCodes(cfg) {
  if (!canReadLive(cfg)) {
    // Datos simulados (personas) para ver el panel sin API key.
    return [
      { id: 'qr_demo1', name: 'Ada Lovelace', type: 'vCard Plus', isPerson: true, folder: 1, folderName: 'Default', scans: 42, uniqueScans: 30, shortUrl: 'https://qrco.de/ada123', targetUrl: '', imageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https%3A%2F%2Fqrco.de%2Fada123', createdAt: '2026-06-01', raw: {} },
      { id: 'qr_demo2', name: 'Grace Hopper', type: 'vCard Plus', isPerson: true, folder: 1, folderName: 'Default', scans: 17, uniqueScans: 12, shortUrl: 'https://qrco.de/grace45', targetUrl: '', imageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https%3A%2F%2Fqrco.de%2Fgrace45', createdAt: '2026-06-10', raw: {} },
    ]
  }

  const folders = await listFolders(cfg)
  const folderName = new Map(folders.map((f) => [String(f.id), f.name]))

  // La API pagina (≈20 por página). Recorremos páginas y deduplicamos por id.
  const seen = new Set()
  const out = []
  for (let page = 1; page <= 100; page++) {
    let data
    try {
      data = await apiFetch(cfg, `/codes?page=${page}&per_page=100`)
    } catch (err) {
      if (page === 1) throw err
      break
    }
    const items = extractList(data).map(normalizeQr)
    let added = 0
    for (const it of items) {
      const key = it.id != null ? String(it.id) : JSON.stringify(it.raw)
      if (!seen.has(key)) { seen.add(key); out.push(it); added++ }
    }
    if (items.length === 0 || added === 0) break
  }
  for (const it of out) {
    it.folderName = it.folder != null ? (folderName.get(String(it.folder)) ?? null) : null
  }
  return out
}

/** Devuelve la respuesta cruda del listado (para calibrar el mapeo). */
export async function listQrCodesRaw(cfg) {
  if (!canReadLive(cfg)) return { note: 'Sin API key: no hay datos reales' }
  return apiFetch(cfg, '/codes')
}

/** Crea un QR DINÁMICO cuyo destino es la URL del pase. */
export async function createDynamicQr(cfg, { name, targetUrl }) {
  if (!cfg.isLive) {
    const code = nanoid(6)
    const shortUrl = `https://${cfg.qrCode.shortDomain}/${code}`
    return {
      qrId: `qr_${code}`,
      shortUrl,
      imageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(shortUrl)}`,
    }
  }
  // ⚙️ AJUSTAR: ruta y campos de creación según tus docs
  const data = await apiFetch(cfg, '/codes', {
    method: 'POST',
    body: {
      name,
      target_url: targetUrl,
      ...(cfg.qrCode.templateId ? { qr_code_template: cfg.qrCode.templateId } : {}),
    },
  })
  const n = normalizeQr(data.code ?? data.data ?? data)
  return { qrId: n.id, shortUrl: n.shortUrl, imageUrl: n.imageUrl }
}

/** Cambia el destino de un QR dinámico ya existente. */
export async function updateQrTarget(cfg, qrId, targetUrl) {
  if (!cfg.isLive) return { ok: true, mocked: true }
  // ⚙️ AJUSTAR
  return apiFetch(cfg, `/codes/${qrId}`, { method: 'PUT', body: { target_url: targetUrl } })
}

/** Analítica de escaneos del QR. */
export async function getQrAnalytics(cfg, qrId) {
  if (!cfg.isLive) {
    return { scans: Math.floor(Math.random() * 80), unique: Math.floor(Math.random() * 50) }
  }
  // ⚙️ AJUSTAR
  const data = await apiFetch(cfg, `/codes/${qrId}/analytics`)
  return {
    scans: data.number_of_scans ?? data.scans ?? 0,
    unique: data.unique_scans ?? data.unique ?? 0,
  }
}

export async function deleteQr(cfg, qrId) {
  if (!cfg.isLive) return { ok: true, mocked: true }
  return apiFetch(cfg, `/codes/${qrId}`, { method: 'DELETE' })
}
