import { nanoid } from 'nanoid'

/**
 * Cliente de AddToWallet (https://app.addtowallet.co) para Cloudflare Workers.
 *
 * IMPORTANTE — contrato a finalizar:
 * Las docs de /api-docs están tras Cloudflare y no fue posible extraer el
 * esquema exacto. Las rutas/campos siguen la forma documentada públicamente.
 * Ajusta SOLO los marcados con  // ⚙️ AJUSTAR  con las docs de tu cuenta.
 */

async function apiFetch(cfg, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${cfg.addToWallet.baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // ⚙️ AJUSTAR: formato exacto del header de auth (Bearer vs x-api-key)
      Authorization: `Bearer ${cfg.addToWallet.apiKey}`,
    },
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
  // ⚙️ AJUSTAR: ruta de listado según tus docs
  const data = await apiFetch(cfg, '/passes')
  return extractList(data).map(normalizePass)
}

/** Devuelve la respuesta cruda del listado (para calibrar el mapeo). */
export async function listPassesRaw(cfg) {
  if (!canReadLive(cfg)) return { note: 'Sin API key: no hay datos reales' }
  return apiFetch(cfg, '/passes')
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
