import { nanoid } from 'nanoid'
import { config, isLive } from '../config.js'

/**
 * Cliente de qr-code-generator (dominio corto qrco.de).
 *
 * IMPORTANTE — contrato a finalizar:
 * Igual que con AddToWallet, las docs están tras Cloudflare. Las rutas/campos
 * siguen la forma habitual de su API de QR dinámicos (crear QR, actualizar URL
 * de destino, analítica). Ajusta los marcados con  // ⚙️ AJUSTAR  con tus docs.
 */

async function apiFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${config.qrCode.baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // ⚙️ AJUSTAR: algunos planes usan ?access-token= en la URL en vez de header
      Authorization: `Bearer ${config.qrCode.apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(
      `qr-code-generator ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`,
    )
  }
  return data
}

/**
 * Crea un QR DINÁMICO cuyo destino es la URL del pase.
 * Dinámico = podemos cambiar el destino luego sin reimprimir el QR.
 * @returns {Promise<{qrId: string, shortUrl: string, imageUrl: string}>}
 */
export async function createDynamicQr({ name, targetUrl }) {
  if (!isLive) {
    const code = nanoid(6)
    return {
      qrId: `qr_${code}`,
      shortUrl: `https://${config.qrCode.shortDomain}/${code}`,
      imageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
        `https://${config.qrCode.shortDomain}/${code}`,
      )}`,
    }
  }

  // ⚙️ AJUSTAR: ruta y campos según docs premium. `qr_code_template` reutiliza
  // tu diseño de QR existente; el nombre exacto del campo puede variar según tu
  // plan (revisa tus docs y ajusta solo esta línea si hace falta).
  const data = await apiFetch('/qr-codes', {
    method: 'POST',
    body: {
      name,
      type: 'dynamic',
      target_url: targetUrl,
      ...(config.qrCode.templateId
        ? { qr_code_template: config.qrCode.templateId }
        : {}),
    },
  })
  return {
    qrId: data.id ?? data.qrId,
    shortUrl: data.short_url ?? data.shortUrl,
    imageUrl: data.image_url ?? data.imageUrl ?? data.png,
  }
}

/** Cambia el destino de un QR dinámico ya existente. */
export async function updateQrTarget(qrId, targetUrl) {
  if (!isLive) return { ok: true, mocked: true }
  // ⚙️ AJUSTAR
  return apiFetch(`/qr-codes/${qrId}`, {
    method: 'PUT',
    body: { target_url: targetUrl },
  })
}

/** Analítica de escaneos del QR. */
export async function getQrAnalytics(qrId) {
  if (!isLive) {
    return { scans: Math.floor(Math.random() * 80), unique: Math.floor(Math.random() * 50) }
  }
  // ⚙️ AJUSTAR
  return apiFetch(`/qr-codes/${qrId}/analytics`)
}

export async function deleteQr(qrId) {
  if (!isLive) return { ok: true, mocked: true }
  return apiFetch(`/qr-codes/${qrId}`, { method: 'DELETE' })
}
