import { sendPassByEmail } from './providers/addToWallet.js'

// Convierte "Nombre <correo@dominio>" en el objeto sender que espera Brevo.
function parseSender(from) {
  const m = String(from).match(/^\s*(.*?)\s*<(.+)>\s*$/)
  if (m) return { name: m[1].replace(/"/g, '').trim() || undefined, email: m[2].trim() }
  return { email: String(from).trim() }
}

/**
 * Envía el pase al contacto.
 *  - EMAIL_PROVIDER=brevo        -> correo propio vía API HTTP de Brevo
 *  - EMAIL_PROVIDER=addtowallet  -> distribución por email de AddToWallet
 * En modo mock no se envía nada real.
 */
export async function sendCardEmail(cfg, card) {
  if (!card.email) throw new Error('La tarjeta no tiene email de destino')
  if (!cfg.isLive) return { mocked: true }

  if (cfg.email.provider === 'brevo') {
    if (!cfg.email.brevoApiKey) throw new Error('Falta BREVO_API_KEY')
    const html = `
      <p>Hola ${card.full_name},</p>
      <p>Aquí tienes tu tarjeta de presentación digital:</p>
      <p><a href="${card.pass_url}">Añadir a tu Wallet</a></p>
      ${card.qr_short_url ? `<p>O escanea tu QR: <a href="${card.qr_short_url}">${card.qr_short_url}</a></p>` : ''}
      <p>— ${card.company || 'Biomar Digital'}</p>
    `
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': cfg.email.brevoApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseSender(cfg.email.from),
        to: [{ email: card.email, name: card.full_name }],
        subject: 'Tu tarjeta de presentación digital',
        htmlContent: html,
      }),
    })
    if (!res.ok) {
      throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }
    return { channel: 'brevo' }
  }

  await sendPassByEmail(cfg, card.pass_id, card.email)
  return { channel: 'addtowallet' }
}
