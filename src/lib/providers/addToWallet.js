import { nanoid } from 'nanoid'

/**
 * Cliente de AddToWallet (https://app.addtowallet.co) para Cloudflare Workers.
 *
 * IMPORTANTE — contrato a finalizar:
 * Las docs de /api-docs están tras Cloudflare y no fue posible extraer el
 * esquema exacto. Las rutas/campos siguen la forma documentada públicamente.
 * Ajusta SOLO los marcados con  // ⚙️ AJUSTAR  con las docs de tu cuenta.
 */

// Cabeceras de auth según el estilo configurado (se descubre con /api/_discover).
function authHeaders(cfg) {
  const key = cfg.addToWallet.apiKey
  switch (cfg.addToWallet.authStyle) {
    case 'x-api-key': return { 'x-api-key': key }
    case 'api-key': return { 'api-key': key }
    default: return { Authorization: `Bearer ${key}` }
  }
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

// Normaliza un pase de la API a la forma del panel (probando varios nombres).
function normalizePass(x) {
  return {
    id: x.id ?? x.passId ?? x.serialNumber ?? null,
    name: x.name ?? x.holderName ?? x.title ?? x.fields?.name ?? '—',
    template: x.templateId ?? x.template ?? x.designId ?? null,
    installUrl: x.url ?? x.passUrl ?? x.installUrl ?? x.link ?? null,
    email: x.email ?? x.fields?.email ?? null,
    createdAt: x.created ?? x.created_at ?? x.createdAt ?? x.date ?? null,
    raw: x,
  }
}

function extractList(data) {
  if (Array.isArray(data)) return data
  return data.passes ?? data.data ?? data.items ?? data.results ?? []
}

/** Lista TODOS los pases de la cuenta. */
export async function listPasses(cfg) {
  if (!canReadLive(cfg)) {
    return [
      { id: 'pass_demo1', name: 'Ada Lovelace', template: cfg.addToWallet.templateId, installUrl: 'https://app.addtowallet.co/p/pass_demo1', email: 'ada@biomar.digital', createdAt: '2026-06-01', raw: {} },
      { id: 'pass_demo2', name: 'Grace Hopper', template: cfg.addToWallet.templateId, installUrl: 'https://app.addtowallet.co/p/pass_demo2', email: 'grace@biomar.digital', createdAt: '2026-06-10', raw: {} },
    ]
  }
  const data = await apiFetch(cfg, cfg.addToWallet.listPath)
  return extractList(data).map(normalizePass)
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

  // ⚙️ AJUSTAR: ruta y mapeo de campos según docs premium
  const payload = {
    templateId: cfg.addToWallet.templateId || undefined,
    fields: {
      name: card.full_name,
      title: card.job_title,
      company: card.company,
      email: card.email,
      phone: card.phone,
      website: card.website,
    },
  }
  const data = await apiFetch(cfg, '/passes', { method: 'POST', body: payload })
  return {
    passId: data.id ?? data.passId,
    passUrl: data.url ?? data.passUrl ?? data.installUrl,
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
