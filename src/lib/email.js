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

// Email de introducción a la tarjeta digital (HTML branded BioMar): logo,
// por qué pasamos al sistema, beneficios, cómo usarla, revisar info + pedir
// cambios, y el botón para agregarla al Wallet.
export function introEmailHtml({ name, passUrl, reviewUrl, base }) {
  const blue = '#1f3e77'
  const headerBg = '#1c4077' // navy exacto del logo, para que el recuadro se funda
  const light = '#82c0e8'
  const ink = '#2d3748'
  const logoUrl = `${base}/biomar-logo.png`
  const wrap = (inner) => `
  <div style="background:#eef3f8;padding:24px 0;font-family:'Segoe UI',Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(22,38,61,.08)">
        ${inner}
      </table>
    </td></tr></table>
  </div>`

  const benefit = (title, text) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>
      <td width="52" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" width="40" bgcolor="${blue}" style="width:40px;background:${blue};border-radius:10px">
          <tr><td align="center" valign="middle" height="40" style="width:40px;height:40px;text-align:center;color:#ffffff;font-size:20px;font-weight:700;font-family:'Segoe UI',Arial,sans-serif;line-height:40px">&#10003;</td></tr>
        </table>
      </td>
      <td valign="top" style="padding-left:8px">
        <div style="font-size:15px;font-weight:700;color:#16263d">${title}</div>
        <div style="font-size:14px;color:${ink};line-height:1.5">${text}</div>
      </td>
    </tr></table>`

  const sectionTitle = (t) => `<div style="font-size:13px;font-weight:700;color:${blue};text-transform:uppercase;letter-spacing:.6px;margin:6px 0 12px">${t}</div>`

  return wrap(`
    <tr><td bgcolor="${headerBg}" style="background:${headerBg};padding:22px 32px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle">
          <span style="color:#fff;font-size:30px;font-weight:800;letter-spacing:.2px;font-family:'Segoe UI',Arial,sans-serif">Bio<span style="color:${light}">Mar</span></span>
        </td>
        <td valign="middle">
          <div style="color:#fff;font-size:20px;font-weight:700;letter-spacing:.3px;padding-left:18px">Digital Business Card</div>
        </td>
      </tr></table>
    </td></tr>

    <tr><td bgcolor="${headerBg}" style="padding:0;font-size:0;line-height:0;background:${headerBg}">
      <img src="${base}/email-banner.jpg" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0"/>
    </td></tr>

    <tr><td style="padding:30px 32px 6px">
      <h1 style="margin:0 0 14px;font-size:22px;color:#16263d">Hi ${name || 'there'},</h1>
      <p style="margin:0 0 14px;color:${ink};font-size:15px;line-height:1.65">
        We're excited to introduce your <b>BioMar Digital Business Card</b> — your professional identity,
        now living in your phone's Wallet.
      </p>
    </td></tr>

    <tr><td style="padding:8px 32px">
      ${sectionTitle('Why we’re moving to digital')}
      <p style="margin:0;color:${ink};font-size:14px;line-height:1.7">
        As part of BioMar's commitment to <b>sustainability and innovation</b>, we're replacing printed business
        cards with a smarter digital version. Printed cards are slow to produce and ship, get outdated quickly,
        and generate paper waste. A digital card is <b>instant, always up to date, and eco-friendly</b> — and it
        keeps our branding consistent across every team and country.
      </p>
    </td></tr>

    <tr><td style="padding:22px 32px 4px">
      ${sectionTitle('What you get')}
      ${benefit('Apple &amp; Google Wallet', 'Save it to your phone’s Wallet — no extra app, no account needed.')}
      ${benefit('Always up to date', 'Job title, contact details or QR can be updated centrally — no reprinting.')}
      ${benefit('Share in a tap', 'Show your QR and the other person saves your contact in the moment.')}
      ${benefit('Sustainable', 'Zero paper and ink — supporting BioMar’s environmental commitments.')}
      ${benefit('Never caught without a card', 'Going to an event? Your card is always with you, on your phone.')}
    </td></tr>

    <tr><td align="center" style="padding:14px 32px 6px">
      <a href="${passUrl}" style="display:inline-block;background:${blue};color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 34px;border-radius:10px">Add to your Wallet</a>
      <div style="color:#9fb3c8;font-size:12px;margin-top:8px">Open this email on your phone for best results</div>
    </td></tr>

    <tr><td style="padding:18px 32px 4px">
      ${sectionTitle('How to use it')}
      <ol style="margin:0;padding-left:18px;color:${ink};font-size:14px;line-height:1.8">
        <li>Tap <b>Add to your Wallet</b> above from your phone.</li>
        <li>Save the card to Apple Wallet or Google Wallet.</li>
        <li>To share, open the card and let others scan its QR code.</li>
      </ol>
    </td></tr>

    <tr><td style="padding:20px 32px 6px">
      <div style="background:#eaf1f8;border-radius:12px;padding:18px 20px">
        ${sectionTitle('Please check your details')}
        <p style="margin:0 0 12px;color:${ink};font-size:14px;line-height:1.6">
          Take a moment to review your card and your QR / vCard — name, job title, email and phone.
          If anything needs fixing, request a change and the team will update it.
        </p>
        ${reviewUrl ? `<a href="${reviewUrl}" style="display:inline-block;background:#fff;border:1.5px solid ${blue};color:${blue};text-decoration:none;font-size:14px;font-weight:700;padding:11px 22px;border-radius:10px">Review my info &amp; request changes</a>` : ''}
      </div>
    </td></tr>

    <tr><td style="background:#f5f9fd;padding:20px 32px;border-top:1px solid #e2e8f0">
      <div style="color:#647890;font-size:13px;font-weight:600">Powered by Partnership. Driven by Innovation.</div>
      <div style="color:#9fb3c8;font-size:11px;margin-top:4px">BioMar — Digital Business Cards</div>
    </td></tr>
  `)
}

/**
 * Avisa al admin (notifyTo) cuando entra una solicitud pública: nueva tarjeta
 * o cambio. No rompe el flujo público si el email falla (se captura fuera).
 */
export async function sendAdminNotification(cfg, { kind, data }) {
  if (!cfg.email.brevoApiKey || !cfg.email.notifyTo) return { skipped: true }
  const isNew = kind === 'new'
  const title = isNew ? 'New digital card request' : 'Change request'
  const row = (k, v) => v ? `<tr><td style="padding:4px 10px 4px 0;color:#647890">${k}</td><td style="padding:4px 0;color:#16263d"><b>${String(v).replace(/</g, '&lt;')}</b></td></tr>` : ''
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#16263d">
      <h2 style="color:#1f3e77;margin:0 0 6px">${title}</h2>
      <p style="color:#647890;margin:0 0 14px">A new request was submitted from the public form.</p>
      <table style="font-size:14px;border-collapse:collapse">
        ${row('Name', data.full_name)}
        ${row('Company', data.company)}
        ${row('Job title', data.job)}
        ${row('Email', data.email)}
        ${row('Phone', data.phone)}
        ${row('Country', data.country)}
        ${row('Message', data.message)}
      </table>
      <p style="margin:18px 0 0"><a href="${cfg.publicUrl}/requests" style="color:#1f3e77">Open the admin panel → Notifications</a></p>
    </div>`
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cfg.email.brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: parseSender(cfg.email.from),
      to: [{ email: cfg.email.notifyTo }],
      replyTo: data.email ? { email: data.email, name: data.full_name || undefined } : undefined,
      subject: `${isNew ? '🆕' : '✏️'} ${title}: ${data.full_name || data.email || 'someone'}`,
      htmlContent: html,
    }),
  })
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return { channel: 'brevo' }
}

/** Envía el email de introducción a una persona (vía Brevo). */
export async function sendIntroEmail(cfg, { name, email, passUrl, qrId }) {
  if (!email) throw new Error('Sin email de destino')
  if (!passUrl) throw new Error('Sin link del pase')
  if (!cfg.email.brevoApiKey) throw new Error('Falta BREVO_API_KEY')

  const reviewUrl = qrId ? `${cfg.publicUrl}/review/${qrId}` : null

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cfg.email.brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: parseSender(cfg.email.from),
      to: [{ email, name: name || undefined }],
      subject: 'Your BioMar Digital Business Card',
      htmlContent: introEmailHtml({ name, passUrl, reviewUrl, base: cfg.publicUrl }),
    }),
  })
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return { channel: 'brevo' }
}
