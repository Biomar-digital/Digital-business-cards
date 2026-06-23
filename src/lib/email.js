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

// Email de introducción a la tarjeta digital (HTML branded BioMar), con
// beneficios, cómo usarla y el botón para agregarla al Wallet.
export function introEmailHtml({ name, passUrl }) {
  const blue = '#1f3e77'
  const benefit = (t) => `<tr><td style="padding:6px 0;color:#2d3748;font-size:14px;line-height:1.5">✓ ${t}</td></tr>`
  return `
  <div style="background:#eef3f8;padding:24px 0;font-family:'Segoe UI',Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(22,38,61,.08)">
          <tr><td style="background:${blue};padding:26px 32px">
            <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px">Bio<span style="color:#82c0e8">Mar</span></span>
            <div style="color:#c7dbf0;font-size:12px;margin-top:4px">Digital Business Card</div>
          </td></tr>
          <tr><td style="padding:30px 32px 8px">
            <h1 style="margin:0 0 12px;font-size:20px;color:#16263d">Hi ${name || 'there'},</h1>
            <p style="margin:0 0 16px;color:#2d3748;font-size:15px;line-height:1.6">
              Welcome to your <b>BioMar Digital Business Card</b> — a modern, sustainable way to share your
              professional identity. No more printed cards: it lives in your phone's Wallet and is always up to date.
            </p>
          </td></tr>
          <tr><td style="padding:0 32px 8px">
            <div style="font-size:13px;font-weight:700;color:${blue};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Why you'll love it</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${benefit('Save it to Apple or Google Wallet — no extra app needed')}
              ${benefit('Share instantly via the QR code on your card')}
              ${benefit('Always current — details update without reprinting')}
              ${benefit('Eco-friendly: zero paper, supporting BioMar sustainability')}
            </table>
          </td></tr>
          <tr><td align="center" style="padding:22px 32px 6px">
            <a href="${passUrl}" style="display:inline-block;background:${blue};color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 30px;border-radius:10px">Add to your Wallet</a>
          </td></tr>
          <tr><td style="padding:8px 32px 26px">
            <div style="font-size:13px;font-weight:700;color:${blue};text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px">How to use it</div>
            <ol style="margin:0;padding-left:18px;color:#2d3748;font-size:14px;line-height:1.7">
              <li>Tap <b>Add to your Wallet</b> above (from your phone).</li>
              <li>Save the card to Apple Wallet or Google Wallet.</li>
              <li>To share, open the card and let others scan its QR.</li>
            </ol>
          </td></tr>
          <tr><td style="background:#f5f9fd;padding:18px 32px;border-top:1px solid #e2e8f0">
            <div style="color:#647890;font-size:12px">Powered by Partnership. Driven by Innovation.</div>
            <div style="color:#9fb3c8;font-size:11px;margin-top:4px">BioMar — Digital Business Cards</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`
}

/** Envía el email de introducción a una persona (vía Brevo). */
export async function sendIntroEmail(cfg, { name, email, passUrl }) {
  if (!email) throw new Error('Sin email de destino')
  if (!passUrl) throw new Error('Sin link del pase')
  if (!cfg.email.brevoApiKey) throw new Error('Falta BREVO_API_KEY')

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cfg.email.brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: parseSender(cfg.email.from),
      to: [{ email, name: name || undefined }],
      subject: 'Your BioMar Digital Business Card',
      htmlContent: introEmailHtml({ name, passUrl }),
    }),
  })
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return { channel: 'brevo' }
}
