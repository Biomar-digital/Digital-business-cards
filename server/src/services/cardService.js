import { nanoid } from 'nanoid'
import { db } from '../db.js'
import * as wallet from '../providers/addToWallet.js'
import * as qr from '../providers/qrCode.js'
import { sendCardEmail } from './emailService.js'

const insertCard = db.prepare(`
  INSERT INTO cards (id, group_id, full_name, job_title, company, email, phone, website, notes, status)
  VALUES (@id, @group_id, @full_name, @job_title, @company, @email, @phone, @website, @notes, @status)
`)

const updateProviders = db.prepare(`
  UPDATE cards SET
    pass_id = @pass_id, pass_url = @pass_url,
    qr_id = @qr_id, qr_short_url = @qr_short_url, qr_image_url = @qr_image_url,
    status = @status, last_error = @last_error, updated_at = datetime('now')
  WHERE id = @id
`)

const getCardStmt = db.prepare('SELECT * FROM cards WHERE id = ?')
const insertLog = db.prepare(`
  INSERT INTO send_logs (id, card_id, channel, to_address, status, error)
  VALUES (@id, @card_id, @channel, @to_address, @status, @error)
`)

export function getCard(id) {
  return getCardStmt.get(id)
}

export function listCards({ groupId } = {}) {
  if (groupId) {
    return db
      .prepare('SELECT * FROM cards WHERE group_id = ? ORDER BY created_at DESC')
      .all(groupId)
  }
  return db.prepare('SELECT * FROM cards ORDER BY created_at DESC').all()
}

/**
 * Flujo unificado: crea el pase en AddToWallet, crea el QR dinámico apuntando
 * al pase, guarda el vínculo y (opcional) envía por email. Si algo falla, la
 * tarjeta queda en estado 'error' con el detalle, sin perder lo ya hecho.
 */
export async function createCard(input, { sendEmail = false } = {}) {
  const id = `card_${nanoid(10)}`
  const card = {
    id,
    group_id: input.groupId ?? null,
    full_name: input.fullName,
    job_title: input.jobTitle ?? null,
    company: input.company ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    notes: input.notes ?? null,
    status: 'draft',
  }
  insertCard.run(card)

  try {
    // 1) Pase en AddToWallet
    const pass = await wallet.createPass(card)

    // 2) QR dinámico que apunta al pase
    const qrCode = await qr.createDynamicQr({
      name: `${card.full_name} — tarjeta`,
      targetUrl: pass.passUrl,
    })

    // 3) Guardar el vínculo
    updateProviders.run({
      id,
      pass_id: pass.passId,
      pass_url: pass.passUrl,
      qr_id: qrCode.qrId,
      qr_short_url: qrCode.shortUrl,
      qr_image_url: qrCode.imageUrl,
      status: 'active',
      last_error: null,
    })
  } catch (err) {
    updateProviders.run({
      id,
      pass_id: null, pass_url: null,
      qr_id: null, qr_short_url: null, qr_image_url: null,
      status: 'error',
      last_error: String(err.message ?? err),
    })
    throw err
  }

  const saved = getCard(id)

  // 4) Email opcional
  if (sendEmail && saved.email) {
    await sendCard(id).catch(() => {}) // el log queda registrado dentro
  }

  return getCard(id)
}

/** Reenvía el pase por email y registra el resultado. */
export async function sendCard(id) {
  const card = getCard(id)
  if (!card) throw new Error('Tarjeta no encontrada')

  let logStatus = 'sent'
  let error = null
  try {
    await sendCardEmail(card)
  } catch (err) {
    logStatus = 'error'
    error = String(err.message ?? err)
  }
  insertLog.run({
    id: `log_${nanoid(10)}`,
    card_id: id,
    channel: 'email',
    to_address: card.email,
    status: logStatus,
    error,
  })
  if (error) throw new Error(error)
  return { ok: true }
}

export function getCardLogs(id) {
  return db
    .prepare('SELECT * FROM send_logs WHERE card_id = ? ORDER BY created_at DESC')
    .all(id)
}

export async function getCardAnalytics(id) {
  const card = getCard(id)
  if (!card?.qr_id) return { scans: 0, unique: 0 }
  return qr.getQrAnalytics(card.qr_id)
}

export async function deleteCard(id) {
  const card = getCard(id)
  if (!card) return
  if (card.pass_id) await wallet.deletePass(card.pass_id).catch(() => {})
  if (card.qr_id) await qr.deleteQr(card.qr_id).catch(() => {})
  db.prepare('DELETE FROM cards WHERE id = ?').run(id)
}
