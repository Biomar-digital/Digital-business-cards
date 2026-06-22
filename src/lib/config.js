// Construye la configuración a partir del entorno del Worker (c.env).
// En Cloudflare no hay process.env: las variables llegan por el binding `env`.

export function getConfig(env) {
  const providerMode = env.PROVIDER_MODE || 'mock'
  return {
    providerMode,
    isLive: providerMode === 'live',
    adminToken: env.ADMIN_TOKEN || '',

    addToWallet: {
      apiKey: env.ADDTOWALLET_API_KEY || '',
      baseUrl: env.ADDTOWALLET_BASE_URL || 'https://app.addtowallet.co/api',
      templateId: env.ADDTOWALLET_TEMPLATE_ID || '',
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
      from: env.EMAIL_FROM || 'Biomar Digital <no-reply@biomar.digital>',
    },
  }
}
