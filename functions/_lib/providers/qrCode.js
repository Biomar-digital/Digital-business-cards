import { nanoid } from 'nanoid'

/**
 * Cliente de qr-code-generator (dominio corto qrco.de) para Cloudflare Workers.
 * Las docs están tras Cloudflare; ajusta los marcados con  // ⚙️ AJUSTAR.
 */

async function apiFetch(cfg, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${cfg.qrCode.baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // ⚙️ AJUSTAR: algunos planes usan ?access-token= en la URL en vez de header
      Authorization: `Bearer ${cfg.qrCode.apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(`qr-code-generator ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  }
  return data
}

/**
 * Crea un QR DINÁMICO cuyo destino es la URL del pase.
 * Dinámico = podemos cambiar el destino luego sin reimprimir el QR.
 */
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

  // ⚙️ AJUSTAR: ruta y campos según docs premium. `qr_code_template` reutiliza
  // tu diseño de QR existente; el nombre exacto del campo puede variar.
  const data = await apiFetch(cfg, '/qr-codes', {
    method: 'POST',
    body: {
      name,
      type: 'dynamic',
      target_url: targetUrl,
      ...(cfg.qrCode.templateId ? { qr_code_template: cfg.qrCode.templateId } : {}),
    },
  })
  return {
    qrId: data.id ?? data.qrId,
    shortUrl: data.short_url ?? data.shortUrl,
    imageUrl: data.image_url ?? data.imageUrl ?? data.png,
  }
}

/** Cambia el destino de un QR dinámico ya existente. */
export async function updateQrTarget(cfg, qrId, targetUrl) {
  if (!cfg.isLive) return { ok: true, mocked: true }
  // ⚙️ AJUSTAR
  return apiFetch(cfg, `/qr-codes/${qrId}`, {
    method: 'PUT',
    body: { target_url: targetUrl },
  })
}

/** Analítica de escaneos del QR. */
export async function getQrAnalytics(cfg, qrId) {
  if (!cfg.isLive) {
    return { scans: Math.floor(Math.random() * 80), unique: Math.floor(Math.random() * 50) }
  }
  // ⚙️ AJUSTAR
  return apiFetch(cfg, `/qr-codes/${qrId}/analytics`)
}

export async function deleteQr(cfg, qrId) {
  if (!cfg.isLive) return { ok: true, mocked: true }
  return apiFetch(cfg, `/qr-codes/${qrId}`, { method: 'DELETE' })
}
