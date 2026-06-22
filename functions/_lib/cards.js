import { nanoid } from 'nanoid'
import { sendCardEmail } from './email.js'
import * as wallet from './providers/addToWallet.js'
import * as qr from './providers/qrCode.js'

// Capa de datos sobre D1 (SQLite async de Cloudflare). `DB` es el binding.

export async function listCards(DB, groupId) {
  if (groupId) {
    const { results } = await DB.prepare(
      'SELECT * FROM cards WHERE group_id = ? ORDER BY created_at DESC',
    )
      .bind(groupId)
      .all()
    return results
  }
  const { results } = await DB.prepare('SELECT * FROM cards ORDER BY created_at DESC').all()
  return results
}

export function getCard(DB, id) {
  return DB.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first()
}

export async function getCardLogs(DB, id) {
  const { results } = await DB.prepare(
    'SELECT * FROM send_logs WHERE card_id = ? ORDER BY created_at DESC',
  )
    .bind(id)
    .all()
  return results
}

/**
 * Flujo unificado: crea el pase en AddToWallet, crea el QR dinámico apuntando
 * al pase, guarda el vínculo y (opcional) envía por email. Si algo falla, la
 * tarjeta queda en estado 'error' con el detalle, sin perder lo ya hecho.
 */
export async function createCard(cfg, DB, input, { sendEmail = false } = {}) {
  const id = `card_${nanoid(10)}`
  await DB.prepare(
    `INSERT INTO cards (id, group_id, full_name, job_title, company, email, phone, website, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
  )
    .bind(
      id,
      input.groupId ?? null,
      input.fullName,
      input.jobTitle ?? null,
      input.company ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.website ?? null,
      input.notes ?? null,
    )
    .run()

  try {
    const card = await getCard(DB, id)

    // 1) Pase en AddToWallet
    const pass = await wallet.createPass(cfg, card)
    // 2) QR dinámico que apunta al pase
    const qrCode = await qr.createDynamicQr(cfg, {
      name: `${card.full_name} — tarjeta`,
      targetUrl: pass.passUrl,
    })
    // 3) Guardar el vínculo
    await DB.prepare(
      `UPDATE cards SET pass_id = ?, pass_url = ?, qr_id = ?, qr_short_url = ?, qr_image_url = ?,
         status = 'active', last_error = NULL, updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(pass.passId, pass.passUrl, qrCode.qrId, qrCode.shortUrl, qrCode.imageUrl, id)
      .run()
  } catch (err) {
    await DB.prepare(
      `UPDATE cards SET status = 'error', last_error = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(String(err.message ?? err), id)
      .run()
    throw err
  }

  // 4) Email opcional
  const saved = await getCard(DB, id)
  if (sendEmail && saved.email) {
    await sendCard(cfg, DB, id).catch(() => {}) // el log queda registrado dentro
  }

  return getCard(DB, id)
}

/** Reenvía el pase por email y registra el resultado. */
export async function sendCard(cfg, DB, id) {
  const card = await getCard(DB, id)
  if (!card) throw new Error('Tarjeta no encontrada')

  let logStatus = 'sent'
  let error = null
  try {
    await sendCardEmail(cfg, card)
  } catch (err) {
    logStatus = 'error'
    error = String(err.message ?? err)
  }
  await DB.prepare(
    `INSERT INTO send_logs (id, card_id, channel, to_address, status, error)
     VALUES (?, ?, 'email', ?, ?, ?)`,
  )
    .bind(`log_${nanoid(10)}`, id, card.email, logStatus, error)
    .run()

  if (error) throw new Error(error)
  return { ok: true }
}

export async function getCardAnalytics(cfg, DB, id) {
  const card = await getCard(DB, id)
  if (!card?.qr_id) return { scans: 0, unique: 0 }
  return qr.getQrAnalytics(cfg, card.qr_id)
}

export async function deleteCard(cfg, DB, id) {
  const card = await getCard(DB, id)
  if (!card) return
  if (card.pass_id) await wallet.deletePass(cfg, card.pass_id).catch(() => {})
  if (card.qr_id) await qr.deleteQr(cfg, card.qr_id).catch(() => {})
  await DB.prepare('DELETE FROM cards WHERE id = ?').bind(id).run()
}
