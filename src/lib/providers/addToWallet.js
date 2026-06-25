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

// Extrae el array de pases. La API responde { msg, data: { passes: [...] } },
// pero contemplamos también variantes al nivel superior.
function asList(data) {
  const keys = (o) => o.cards ?? o.passes ?? o.templates ?? o.dynamicPasses ?? o.groups ?? o.users ?? o.items ?? o.results
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const direct = keys(data)
    if (Array.isArray(direct)) return direct
    const d = data.data
    if (d && typeof d === 'object') {
      const nested = keys(d)
      if (Array.isArray(nested)) return nested
    }
  }
  return null
}

function extractList(data) {
  return asList(data) ?? []
}

// Info de paginación (anidada bajo data o al nivel superior).
function paginationOf(data) {
  return data?.data?.pagination ?? data?.pagination ?? null
}

function headersForStyle(cfg, style) {
  const key = cfg.addToWallet.apiKey
  if (style === 'apikey') return { apikey: key }
  if (style === 'x-api-key') return { 'x-api-key': key }
  if (style === 'api-key') return { 'api-key': key }
  return { Authorization: `Bearer ${key}` }
}

/**
 * Lista TODOS los pases: GET /api/card/get (cabecera apikey). La respuesta es
 * { msg, data: { passes: [...], pagination: {...} } }. Recorre todas las
 * páginas para traer el total.
 */
export async function listPasses(cfg) {
  if (!canReadLive(cfg)) {
    return [
      { id: 'pass_demo1', name: 'Ada Lovelace', title: 'CTO', business: 'BioMar', email: 'ada@biomar.digital', phone: null, status: 'ACTIVE', createdAt: '2026-06-01', raw: {} },
      { id: 'pass_demo2', name: 'Grace Hopper', title: 'Admiral', business: 'BioMar', email: 'grace@biomar.digital', phone: null, status: 'ACTIVE', createdAt: '2026-06-10', raw: {} },
    ]
  }

  const all = []
  const seen = new Set()
  let pageSize = 0
  for (let page = 1; page <= 100; page++) {
    const data = await apiFetch(cfg, `${cfg.addToWallet.listPath}?page=${page}`)
    const list = asList(data) || []
    if (list.length === 0) break
    if (page === 1) pageSize = list.length

    let fresh = 0
    for (const x of list) {
      const id = x._id ?? x.id
      const key = id ? String(id) : JSON.stringify(x).slice(0, 120)
      if (seen.has(key)) continue
      seen.add(key); all.push(x); fresh++
    }

    // Condiciones de fin, tolerando distintos nombres de campos de paginación.
    const pg = paginationOf(data) || {}
    const totalPages = pg.totalPages ?? pg.total_pages ?? pg.pages ?? null
    const total = pg.total ?? pg.totalCount ?? pg.count ?? null
    if (fresh === 0) break // la API ignora ?page= o no hay datos nuevos
    if (totalPages && page >= totalPages) break
    if (total && all.length >= total) break
    if (pageSize && list.length < pageSize) break // página corta = última
  }
  // Ocultamos las definiciones de plantilla (filas con placeholders como
  // "{name}"/"{email}") para mostrar solo los pases reales de personas.
  const isTemplate = (p) =>
    [p.name, p.email, p.title].some((v) => typeof v === 'string' && /\{[^}]+\}/.test(v))
  return all.map(normalizePass).filter((p) => !isTemplate(p))
}

function normalizeTemplate(x) {
  const td = x.templateData ?? x.template ?? {}
  return {
    id: x.dynamicPassId ?? x._id ?? x.id ?? null,
    name: x.name ?? td.cardTitle ?? '—',
    groupId: x.groupId ?? x.group_id ?? null,
    cardTitle: td.cardTitle ?? x.cardTitle ?? null,
    createdAt: x.createdAt ?? x.created_at ?? null,
    raw: x,
  }
}

/** Lista las plantillas dinámicas (GET /api/dynamicPass/templates). */
export async function listTemplates(cfg) {
  if (!canReadLive(cfg)) {
    return [{ id: 'tpl_demo', name: 'BioMar Dynamic Card', groupId: 'grp_demo', cardTitle: 'BioMar', createdAt: '2026-05-01', raw: {} }]
  }
  const data = await apiFetch(cfg, '/dynamicPass/templates')
  return (asList(data) || []).map(normalizeTemplate)
}

/** Respuesta cruda de plantillas (para calibrar). */
export async function listTemplatesRaw(cfg) {
  if (!canReadLive(cfg)) return { note: 'Sin API key' }
  return apiFetch(cfg, '/dynamicPass/templates')
}

/** Devuelve la respuesta cruda del listado (para calibrar el mapeo). */
export async function listPassesRaw(cfg) {
  if (!canReadLive(cfg)) return { note: 'Sin API key: no hay datos reales' }
  return apiFetch(cfg, cfg.addToWallet.listPath)
}

/**
 * Diagnóstico: llama al endpoint exacto de las docs y devuelve status + cuerpo
 * SIN lanzar error, para ver qué responde realmente la API.
 */
export async function debugList(cfg) {
  if (!canReadLive(cfg)) return { note: 'Sin API key' }
  const attempts = []
  const candidates = [
    { url: `${cfg.addToWallet.baseUrl}/card/get`, style: 'apikey' },
    { url: 'https://app.addtowallet.co/api/card/get', style: 'apikey' },
    { url: 'https://app.addtowallet.co/card/get', style: 'apikey' },
  ]
  for (const { url, style } of candidates) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...headersForStyle(cfg, style) },
      })
      const body = await res.text()
      attempts.push({ url, authStyle: style, status: res.status, body: body.slice(0, 1200) })
    } catch (e) {
      attempts.push({ url, authStyle: style, error: String(e.message ?? e) })
    }
  }
  return { attempts }
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

/**
 * PRUEBA: crea un wallet pass real reutilizando el diseño de una plantilla
 * existente (logoUrl/heroImage/colores BioMar). Devuelve el resultado crudo.
 */
export async function createTestPass(cfg, barcodeValue) {
  let design = {}
  try {
    const data = await apiFetch(cfg, cfg.addToWallet.listPath)
    const cardsList = asList(data) || []
    const t = cardsList.find((c) => c.logoUrl && c.heroImage) || cardsList[0] || {}
    design = {
      logoUrl: t.logoUrl, heroImage: t.heroImage,
      googleHeroImage: t.googleHeroImage, appleHeroImage: t.appleHeroImage,
      hexBackgroundColor: t.hexBackgroundColor, appleFontColor: t.appleFontColor,
    }
  } catch {
    // seguimos con fallbacks
  }
  const payload = {
    cardTitle: 'BioMar Group',
    header: 'TEST — API Card',
    subheader: 'Please ignore / delete',
    logoUrl: design.logoUrl || 'https://s3.amazonaws.com/i.addtowallet.co/addtowallet-f71f1720-61b2-41ca-a212-c2300893d2b7',
    heroImage: design.heroImage || 'https://s3.amazonaws.com/i.addtowallet.co/addtowallet-11bb2dc7-d73e-48f9-bcd3-6e76b9d350f7',
    googleHeroImage: design.googleHeroImage || design.heroImage,
    appleHeroImage: design.appleHeroImage || design.heroImage,
    hexBackgroundColor: design.hexBackgroundColor || '#1F3E77',
    appleFontColor: design.appleFontColor || '#ffffff',
    barcodeType: 'QR_CODE',
    barcodeValue: barcodeValue || 'https://www.biomar.com',
    barcodeAltText: 'Scan to add contact',
    textModulesData: [
      { id: 'r1start', header: 'Email', body: 'test@biomar.com' },
      { id: 'r1end', header: 'Phone', body: '+45 00000000' },
    ],
    linksModuleData: [{ id: 'r1', description: 'Website', uri: 'https://www.biomar.com' }],
  }
  const res = await fetch(`${cfg.addToWallet.baseUrl}/card/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* texto */ }
  return { status: res.status, ok: res.ok, response: json ?? text.slice(0, 600), sentDesign: design }
}

/**
 * Crea un pase de EJEMPLO con el template real (logo/hero/colores tomados de un
 * pase existente) y datos de muestra ("BioMar Employee"). Devuelve el link del
 * pase para abrirlo y hacerle screenshot. Pensado para mockups.
 */
export async function createExamplePass(cfg) {
  const design = await getTemplateDesign(cfg)
  const payload = {
    cardTitle: 'BioMar Group',
    header: 'Alex Johansen',
    subheader: 'BioMar Employee',
    logoUrl: design.logoUrl,
    heroImage: design.heroImage,
    googleHeroImage: design.googleHeroImage || design.heroImage,
    appleHeroImage: design.appleHeroImage || design.heroImage,
    hexBackgroundColor: design.hexBackgroundColor || '#1c4077',
    appleFontColor: design.appleFontColor || '#ffffff',
    barcodeType: 'QR_CODE',
    barcodeValue: 'https://www.biomar.com',
    barcodeAltText: 'Scan to add contact',
    textModulesData: [
      { id: 'r1start', header: 'Email', body: 'alex.johansen@biomar.com' },
      { id: 'r1end', header: 'Phone', body: '+45 25 50 50 10' },
    ],
    linksModuleData: [
      { id: 'r1', description: 'Call', uri: 'tel:+4525505010' },
      { id: 'r2', description: 'Email', uri: 'mailto:alex.johansen@biomar.com' },
      { id: 'r3', description: 'Website', uri: 'https://www.biomar.com' },
    ],
  }
  const res = await fetch(`${cfg.addToWallet.baseUrl}/card/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* texto */ }
  const id = json?.cardId ?? json?.id ?? json?._id ?? json?.card?._id ?? null
  return {
    status: res.status,
    ok: res.ok,
    cardId: id,
    passUrl: json?.shareUrl ?? json?.url ?? (id ? `https://app.addtowallet.co/card/${id}` : null),
    passGeneratorUrl: id ? `https://app.addtowallet.co/passGenerator/${id}` : null,
    usedDesign: design,
    response: json ?? text.slice(0, 600),
  }
}

/** PRUEBA: borra un pase creado en la prueba (para limpiar). */
export async function deleteTestPass(cfg, id) {
  for (const path of [`/card/delete/${id}`, `/card/${id}`, '/card/delete']) {
    try {
      const res = await fetch(`${cfg.addToWallet.baseUrl}${path}`, {
        method: path === '/card/delete' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
        body: path === '/card/delete' ? JSON.stringify({ id, cardId: id }) : undefined,
      })
      const text = await res.text()
      if (res.ok) return { ok: true, path, status: res.status, body: text.slice(0, 300) }
    } catch { /* siguiente */ }
  }
  return { ok: false }
}

/** Diseño (logo/hero/colores) tomado de una plantilla existente, para reusar. */
export async function getTemplateDesign(cfg) {
  try {
    const data = await apiFetch(cfg, cfg.addToWallet.listPath)
    const cardsList = asList(data) || []
    const t = cardsList.find((c) => c.logoUrl && c.heroImage) || cardsList[0] || {}
    return {
      logoUrl: t.logoUrl, heroImage: t.heroImage,
      googleHeroImage: t.googleHeroImage, appleHeroImage: t.appleHeroImage,
      hexBackgroundColor: t.hexBackgroundColor, appleFontColor: t.appleFontColor,
    }
  } catch {
    return {}
  }
}

/**
 * Crea un wallet pass para un contacto (persona), con el barcode apuntando a su
 * vCard QR (short_url). Reusa el diseño de la plantilla BioMar.
 */
export async function createPassForContact(cfg, contact, design = {}) {
  const phone = contact.mobile || contact.phone
  const text = []
  if (contact.email) text.push({ id: 'r1start', header: 'Email', body: contact.email })
  if (phone) text.push({ id: 'r1end', header: 'Phone', body: phone })
  const links = []
  if (phone) links.push({ id: 'r1', description: 'Call', uri: `tel:${phone}` })
  if (contact.email) links.push({ id: 'r2', description: 'Email', uri: `mailto:${contact.email}` })
  if (contact.website) {
    const w = String(contact.website)
    links.push({ id: 'r3', description: 'Website', uri: w.startsWith('http') ? w : `https://${w}` })
  }
  const payload = {
    cardTitle: contact.company || 'BioMar',
    header: contact.full_name || 'BioMar',
    subheader: contact.job || undefined,
    logoUrl: design.logoUrl || 'https://s3.amazonaws.com/i.addtowallet.co/addtowallet-9cd5f4fb-de93-4c47-b733-7cff3b3ff8b9',
    heroImage: design.heroImage || 'https://s3.amazonaws.com/i.addtowallet.co/addtowallet-9b25762b-12d8-4571-9030-0999e440626c',
    googleHeroImage: design.googleHeroImage || design.heroImage,
    appleHeroImage: design.appleHeroImage || design.heroImage,
    hexBackgroundColor: design.hexBackgroundColor || '#1f3e77',
    appleFontColor: design.appleFontColor || '#ffffff',
    barcodeType: 'QR_CODE',
    barcodeValue: contact.short_url || 'https://www.biomar.com',
    barcodeAltText: 'Scan to add contact',
    textModulesData: text,
    linksModuleData: links,
  }
  const data = await apiFetch(cfg, '/card/create', { method: 'POST', body: payload })
  const id = data.cardId ?? data.id ?? data._id ?? null
  return { passId: id, passUrl: data.shareUrl ?? data.url ?? (id ? `https://app.addtowallet.co/card/${id}` : null) }
}

/**
 * Actualiza un wallet pass YA existente con los datos del contacto (push al
 * pase que la persona ya agregó). El endpoint exacto de update no está en las
 * docs que pudimos leer, así que probamos varios candidatos y devolvemos el
 * resultado crudo para confirmar cuál funciona.
 */
export async function updatePassForContact(cfg, contact, design = {}) {
  if (!contact.pass_id) return { ok: false, error: 'El contacto no tiene pass_id' }
  const phone = contact.mobile || contact.phone
  const text = []
  if (contact.email) text.push({ id: 'r1start', header: 'Email', body: contact.email })
  if (phone) text.push({ id: 'r1end', header: 'Phone', body: phone })
  const links = []
  if (phone) links.push({ id: 'r1', description: 'Call', uri: `tel:${phone}` })
  if (contact.email) links.push({ id: 'r2', description: 'Email', uri: `mailto:${contact.email}` })

  const payload = {
    cardId: contact.pass_id,
    cardTitle: contact.company || 'BioMar',
    header: contact.full_name || 'BioMar',
    subheader: contact.job || undefined,
    hexBackgroundColor: design.hexBackgroundColor || '#1f3e77',
    appleFontColor: design.appleFontColor || '#ffffff',
    barcodeType: 'QR_CODE',
    barcodeValue: contact.short_url || 'https://www.biomar.com',
    barcodeAltText: 'Scan to add contact',
    textModulesData: text,
    linksModuleData: links,
  }
  if (design.logoUrl) payload.logoUrl = design.logoUrl
  if (design.heroImage) { payload.heroImage = design.heroImage; payload.googleHeroImage = design.heroImage; payload.appleHeroImage = design.heroImage }

  const candidates = [
    { path: '/card/update', method: 'POST' },
    { path: `/card/update/${contact.pass_id}`, method: 'PUT' },
    { path: `/card/update/${contact.pass_id}`, method: 'POST' },
    { path: `/card/edit/${contact.pass_id}`, method: 'POST' },
    { path: `/card/${contact.pass_id}`, method: 'PUT' },
  ]
  const attempts = []
  for (const c of candidates) {
    try {
      const res = await fetch(`${cfg.addToWallet.baseUrl}${c.path}`, {
        method: c.method,
        headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
        body: JSON.stringify(payload),
      })
      const t = await res.text()
      if (res.ok) {
        let json = null
        try { json = JSON.parse(t) } catch { /* texto */ }
        return { ok: true, path: c.path, method: c.method, status: res.status, response: json ?? t.slice(0, 300) }
      }
      attempts.push({ path: c.path, method: c.method, status: res.status, body: t.slice(0, 120) })
    } catch (e) {
      attempts.push({ path: c.path, method: c.method, error: String(e.message ?? e).slice(0, 120) })
    }
  }
  return { ok: false, attempts }
}
