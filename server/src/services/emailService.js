import nodemailer from 'nodemailer'
import { config } from '../config.js'
import { sendPassByEmail } from '../providers/addToWallet.js'

let transporter = null
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.port === 465,
      auth: config.email.smtp.user
        ? { user: config.email.smtp.user, pass: config.email.smtp.pass }
        : undefined,
    })
  }
  return transporter
}

/**
 * Envía el pase al contacto. Por defecto delega en la distribución de
 * AddToWallet; si EMAIL_PROVIDER=smtp, manda un correo propio con los enlaces.
 */
export async function sendCardEmail(card) {
  if (!card.email) throw new Error('La tarjeta no tiene email de destino')

  if (config.email.provider === 'smtp') {
    const html = `
      <p>Hola ${card.full_name},</p>
      <p>Aquí tienes tu tarjeta de presentación digital:</p>
      <p><a href="${card.pass_url}">Añadir a tu Wallet</a></p>
      ${card.qr_short_url ? `<p>O escanea tu QR: <a href="${card.qr_short_url}">${card.qr_short_url}</a></p>` : ''}
      <p>— ${card.company || 'Biomar Digital'}</p>
    `
    await getTransporter().sendMail({
      from: config.email.from,
      to: card.email,
      subject: 'Tu tarjeta de presentación digital',
      html,
    })
    return { channel: 'smtp' }
  }

  await sendPassByEmail(card.pass_id, card.email)
  return { channel: 'addtowallet' }
}
