import { nanoid } from 'nanoid'

/**
 * Cliente de AddToWallet (https://app.addtowallet.co) para Cloudflare Workers.
 *
 * IMPORTANTE — contrato a finalizar:
 * Las docs de /api-docs están tras Cloudflare y no fue posible extraer el
 * esquema exacto. Las rutas/campos siguen la forma documentada públicamente.
 * Ajusta SOLO los marcados con  // ⚙️ AJUSTAR  con las docs de tu cuenta.
 */

// Cabeceras de auth. AddToWallet usa `apikey: <key>` (ver docs Get/Create Pass).
function authHeaders(cfg) {
  return headersForStyle(cfg, cfg.addToWallet.authStyle)
}

async function apiFetch(cfg, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${cfg.addToWallet.baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(`AddToWallet ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  }
  return data
}

// ¿Podemos leer datos reales? Sí en cuanto haya API key (lectura segura),
// aunque PROVIDER_MODE siga en mock.
function canReadLive(cfg) {
  return Boolean(cfg.addToWallet.apiKey)
}

// Normaliza un pase ("card") de AddToWallet a la forma del panel, según el
// shape real de GET /api/card/get.
function normalizePass(x) {
  const text = Array.isArray(x.textModulesData) ? x.textModulesData : []
  const links = Array.isArray(x.linksModuleData) ? x.linksModuleData : []
  const textBody = (h) => text.find((t) => String(t.header || '').toLowerCase() === h)?.body
  const linkValue = (prefix) => {
    const l = links.find((l) => String(l.uri || '').toLowerCase().startsWith(prefix))
    return l ? l.uri.slice(prefix.length) : null
  }
  return {
    id: x._id ?? x.id ?? null,
    name: x.header ?? x.name ?? '—',
    title: x.subheader ?? null,
    business: x.cardTitle ?? null,
    email: textBody('email') ?? linkValue('mailto:') ?? null,
    phone: textBody('phone') ?? linkValue('tel:') ?? null,
    status: x.stateType ?? null,
    createdAt: x.createdAt ?? x.created_at ?? x.created ?? null,
    raw: x,
  }
}

function extractList(data) {
  if (Array.isArray(data)) return data
  return data.cards ?? data.passes ?? data.data ?? data.items ?? data.results ?? []
}

// Devuelve el array de pases si la respuesta TIENE forma de lista, o null si no
// lo es (evita aceptar por error un 200 que no sea un listado).
function asList(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const v = data.cards ?? data.passes ?? data.data ?? data.items ?? data.results
    if (Array.isArray(v)) return v
  }
  return null
}

function headersForStyle(cfg, style) {
  const key = cfg.addToWallet.apiKey
  if (style === 'apikey') return { apikey: key }
  if (style === 'x-api-key') return { 'x-api-key': key }
  if (style === 'api-key') return { 'api-key': key }
  return { Authorization: `Bearer ${key}` }
}

// Combo (ruta + estilo de auth) que funcionó, cacheado por isolate.
let cachedCombo = null

async function tryList(cfg, path, style) {
  const res = await fetch(`${cfg.addToWallet.baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...headersForStyle(cfg, style) },
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  return { ok: res.ok, status: res.status, list: res.ok ? asList(data) : null }
}

/**
 * Lista TODOS los pases de la cuenta. AddToWallet usa una ruta de listado que
 * sus docs (tras Cloudflare) no exponen, así que el Worker la AUTODESCUBRE:
 * prueba rutas + estilos de auth candidatos y usa el primero que devuelva una
 * lista. El combo ganador queda cacheado. Si ninguno funciona, lo avisa claro.
 */
export async function listPasses(cfg) {
  if (!canReadLive(cfg)) {
    return [
      { id: 'pass_demo1', name: 'Ada Lovelace', template: cfg.addToWallet.templateId, installUrl: 'https://app.addtowallet.co/p/pass_demo1', email: 'ada@biomar.digital', createdAt: '2026-06-01', raw: {} },
      { id: 'pass_demo2', name: 'Grace Hopper', template: cfg.addToWallet.templateId, installUrl: 'https://app.addtowallet.co/p/pass_demo2', email: 'grace@biomar.digital', createdAt: '2026-06-10', raw: {} },
    ]
  }

  const paths = [
    cfg.addToWallet.listPath, '/passes', '/pass', '/passes/list', '/pass/list',
    '/passes/all', '/list', '/getPasses', '/get-passes', '/templates',
    '/direct-api/passes', '/v1/passes',
  ]
  const styles = [cfg.addToWallet.authStyle, 'bearer', 'x-api-key', 'api-key']

  const combos = []
  if (cachedCombo) combos.push(cachedCombo)
  for (const path of [...new Set(paths)]) {
    for (const style of [...new Set(styles)]) combos.push({ path, style })
  }

  let lastStatus = null
  for (const { path, style } of combos) {
    let r
    try { r = await tryList(cfg, path, style) } catch { continue }
    lastStatus = r.status
    if (r.list) {
      cachedCombo = { path, style }
      return r.list.map(normalizePass)
    }
  }
  throw new Error(
    `No encontré un endpoint para listar pases en AddToWallet (probé varias rutas y estilos de auth; último estado HTTP ${lastStatus}). Es posible que esta API no permita listar todos los pases — habría que confirmarlo con su soporte/docs.`,
  )
}

/** Devuelve la respuesta cruda del listado (para calibrar el mapeo). */
export async function listPassesRaw(cfg) {
  if (!canReadLive(cfg)) return { note: 'Sin API key: no hay datos reales' }
  return apiFetch(cfg, cfg.addToWallet.listPath)
}

/**
 * "Lee la API" desde el Worker (que sí alcanza app.addtowallet.co): intenta
 * bajar la especificación OpenAPI/Swagger y prueba rutas + estilos de auth
 * candidatos. Devuelve un resumen para fijar listPath/authStyle exactos.
 */
export async function discover(cfg) {
  const origin = new URL(cfg.addToWallet.baseUrl).origin
  const base = cfg.addToWallet.baseUrl

  const specUrls = [
    `${origin}/api-docs/swagger.json`,
    `${origin}/api-docs.json`,
    `${origin}/api-docs/openapi.json`,
    `${origin}/api-docs/direct-api/swagger.json`,
    `${origin}/swagger.json`,
    `${origin}/openapi.json`,
    `${base}/swagger.json`,
    `${base}/docs.json`,
  ]
  const apiPaths = [
    '/passes', '/pass', '/passes/list', '/pass/list', '/list', '/passes/all',
    '/getPasses', '/get-passes', '/templates', '/template', '/direct-api/passes',
    '/direct-api/pass-list', '/v1/passes', '/me', '/account', '/user',
  ]
  const authStyles = ['bearer', 'x-api-key', 'api-key']

  const headersFor = (style) => {
    const key = cfg.addToWallet.apiKey
    if (style === 'x-api-key') return { 'x-api-key': key }
    if (style === 'api-key') return { 'api-key': key }
    return { Authorization: `Bearer ${key}` }
  }

  async function tryFetch(url, headers) {
    try {
      const r = await fetch(url, { headers })
      const t = await r.text()
      return { status: r.status, contentType: r.headers.get('content-type'), snippet: t.slice(0, 400) }
    } catch (e) {
      return { error: String(e.message ?? e) }
    }
  }

  const specs = []
  for (const u of specUrls) specs.push({ url: u, ...(await tryFetch(u, headersFor('bearer'))) })

  // Prueba cada ruta con los 3 estilos de auth, parando en la primera 2xx.
  const probes = []
  for (const p of apiPaths) {
    for (const style of authStyles) {
      const r = await tryFetch(`${base}${p}`, headersFor(style))
      probes.push({ path: p, auth: style, status: r.status, snippet: r.snippet, error: r.error })
      if (r.status && r.status >= 200 && r.status < 300) break
    }
  }
  return { base, specs, probes }
}

/** Crea un pase wallet a partir de los datos de una tarjeta. */
export async function createPass(cfg, card) {
  if (!cfg.isLive) {
    const passId = `pass_${nanoid(10)}`
    return { passId, passUrl: `https://app.addtowallet.co/p/${passId}` }
  }

  // POST /api/card/create (cabecera apikey). Campos según docs Create Pass.
  const links = []
  if (card.phone) links.push({ id: 'r1', description: 'Call us', uri: `tel:${card.phone}` })
  if (card.email) links.push({ id: 'r2', description: 'Email us', uri: `mailto:${card.email}` })
  if (card.website) links.push({ id: 'r3', description: 'Website', uri: card.website })

  const text = []
  if (card.phone) text.push({ id: 'r1start', header: 'Phone', body: card.phone })
  if (card.email) text.push({ id: 'r1end', header: 'Email', body: card.email })

  const payload = {
    cardTitle: card.company || 'BioMar',
    header: card.full_name,
    subheader: card.job_title || undefined,
    hexBackgroundColor: '#1b3c74',
    appleFontColor: '#FFFFFF',
    barcodeType: 'QR_CODE',
    linksModuleData: links,
    textModulesData: text,
    // ⚙️ logoUrl/heroImage son obligatorios en la API. Si tu cuenta los toma
    // de la plantilla no hace falta; si la API los exige, añade aquí las URLs.
  }
  const data = await apiFetch(cfg, '/card/create', { method: 'POST', body: payload })
  const id = data.id ?? data._id ?? data.cardId ?? data.card?._id
  return {
    passId: id,
    passUrl:
      data.url ?? data.passUrl ?? data.shareUrl ?? data.cardUrl ??
      (id ? `https://app.addtowallet.co/c/${id}` : null),
  }
}

/** Reenvía un pase existente por email usando la distribución de AddToWallet. */
export async function sendPassByEmail(cfg, passId, email) {
  if (!cfg.isLive) return { ok: true, mocked: true }
  // ⚙️ AJUSTAR: ruta de distribución por email según docs premium
  return apiFetch(cfg, `/passes/${passId}/send`, {
    method: 'POST',
    body: { channel: 'email', to: email },
  })
}

export async function deletePass(cfg, passId) {
  if (!cfg.isLive) return { ok: true, mocked: true }
  return apiFetch(cfg, `/passes/${passId}`, { method: 'DELETE' })
}
