import { nanoid } from 'nanoid'
import { config, isLive } from '../config.js'

/**
 * Cliente de AddToWallet (https://app.addtowallet.co).
 *
 * IMPORTANTE — contrato a finalizar:
 * Las páginas de /api-docs están protegidas por Cloudflare y no fue posible
 * extraer el esquema exacto de forma automática. Las rutas/campos de abajo
 * siguen la forma documentada públicamente (API directa con API key, endpoint
 * "create pass"). Cuando tengas las docs de tu cuenta premium delante, ajusta
 * SOLO los marcados con  // ⚙️ AJUSTAR  y el resto del sistema sigue igual.
 */

async function apiFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${config.addToWallet.baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // ⚙️ AJUSTAR: formato exacto del header de auth (Bearer vs x-api-key)
      Authorization: `Bearer ${config.addToWallet.apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(
      `AddToWallet ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`,
    )
  }
  return data
}

/**
 * Crea un pase wallet a partir de los datos de una tarjeta.
 * @returns {Promise<{passId: string, passUrl: string}>}
 */
export async function createPass(card) {
  if (!isLive) {
    const passId = `pass_${nanoid(10)}`
    return {
      passId,
      passUrl: `https://app.addtowallet.co/p/${passId}`,
    }
  }

  // ⚙️ AJUSTAR: ruta y mapeo de campos según docs premium
  const payload = {
    templateId: config.addToWallet.templateId || undefined,
    fields: {
      name: card.full_name,
      title: card.job_title,
      company: card.company,
      email: card.email,
      phone: card.phone,
      website: card.website,
    },
  }
  const data = await apiFetch('/passes', { method: 'POST', body: payload })
  return {
    passId: data.id ?? data.passId,
    passUrl: data.url ?? data.passUrl ?? data.installUrl,
  }
}

/**
 * Reenvía un pase existente por email usando la distribución de AddToWallet.
 */
export async function sendPassByEmail(passId, email) {
  if (!isLive) {
    return { ok: true, mocked: true }
  }
  // ⚙️ AJUSTAR: ruta de distribución por email según docs premium
  return apiFetch(`/passes/${passId}/send`, {
    method: 'POST',
    body: { channel: 'email', to: email },
  })
}

export async function deletePass(passId) {
  if (!isLive) return { ok: true, mocked: true }
  return apiFetch(`/passes/${passId}`, { method: 'DELETE' })
}
