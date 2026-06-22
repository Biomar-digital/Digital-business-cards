import 'dotenv/config'

const required = []

function read(name, fallback = undefined) {
  const value = process.env[name] ?? fallback
  return value
}

export const config = {
  port: Number(read('PORT', 4000)),
  providerMode: read('PROVIDER_MODE', 'mock'), // 'mock' | 'live'
  adminToken: read('ADMIN_TOKEN', ''),

  addToWallet: {
    apiKey: read('ADDTOWALLET_API_KEY', ''),
    baseUrl: read('ADDTOWALLET_BASE_URL', 'https://app.addtowallet.co/api'),
    templateId: read('ADDTOWALLET_TEMPLATE_ID', ''),
  },

  qrCode: {
    apiKey: read('QRCODE_API_KEY', ''),
    baseUrl: read('QRCODE_BASE_URL', 'https://api.qr-code-generator.com/v1'),
    shortDomain: read('QRCODE_SHORT_DOMAIN', 'qrco.de'),
    // Plantilla/diseño de QR a reutilizar (para que los QR nuevos salgan con
    // el mismo estilo que los que ya tienes creados). Vacío = diseño por defecto.
    templateId: read('QRCODE_TEMPLATE_ID', ''),
  },

  email: {
    provider: read('EMAIL_PROVIDER', 'addtowallet'), // 'addtowallet' | 'smtp'
    from: read('EMAIL_FROM', 'Biomar Digital <no-reply@biomar.digital>'),
    smtp: {
      host: read('SMTP_HOST', ''),
      port: Number(read('SMTP_PORT', 587)),
      user: read('SMTP_USER', ''),
      pass: read('SMTP_PASS', ''),
    },
  },
}

export const isLive = config.providerMode === 'live'

export function assertLiveConfig() {
  const missing = []
  if (!config.addToWallet.apiKey) missing.push('ADDTOWALLET_API_KEY')
  if (!config.qrCode.apiKey) missing.push('QRCODE_API_KEY')
  if (missing.length) {
    throw new Error(
      `PROVIDER_MODE=live requiere: ${missing.join(', ')}. Revisa tu archivo .env`,
    )
  }
}
