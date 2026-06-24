// Construye la configuración a partir del entorno del Worker (c.env).
// En Cloudflare no hay process.env: las variables llegan por el binding `env`.

export function getConfig(env) {
  const providerMode = env.PROVIDER_MODE || 'mock'
  return {
    providerMode,
    isLive: providerMode === 'live',
    adminToken: env.ADMIN_TOKEN || '',
    publicUrl: env.PUBLIC_URL || 'https://igitalbusinesscards.marketing-70b.workers.dev',

    addToWallet: {
      apiKey: env.ADDTOWALLET_API_KEY || '',
      // Host real de la API: app.addtowallet.co (el "api." del curl de las docs
      // es un typo; ese host da 530/DNS error). Endpoint: /api/card/get.
      baseUrl: env.ADDTOWALLET_BASE_URL || 'https://app.addtowallet.co/api',
      templateId: env.ADDTOWALLET_TEMPLATE_ID || '',
      // "Get Passes" según docs: GET /api/card/get con cabecera `apikey: <key>`.
      listPath: env.ADDTOWALLET_LIST_PATH || '/card/get',
      authStyle: env.ADDTOWALLET_AUTH_STYLE || 'apikey', // apikey | bearer | x-api-key | api-key
    },

    qrCode: {
      apiKey: env.QRCODE_API_KEY || '',
      baseUrl: env.QRCODE_BASE_URL || 'https://api.qr-code-generator.com/v1',
      shortDomain: env.QRCODE_SHORT_DOMAIN || 'qrco.de',
      templateId: env.QRCODE_TEMPLATE_ID || '',
    },

    email: {
      provider: env.EMAIL_PROVIDER || 'brevo', // brevo | addtowallet
      brevoApiKey: env.BREVO_API_KEY || '',
      from: env.EMAIL_FROM || 'BioMar Digital Business Cards <marketing@biomar.com>',
      // A dónde llegan las notificaciones de solicitudes (nueva tarjeta / cambios).
      notifyTo: env.NOTIFY_EMAIL || 'marketing@biomar.com',
    },
  }
}
