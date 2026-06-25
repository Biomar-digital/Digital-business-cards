import { nanoid } from 'nanoid'

// Página pública de "revisá tu tarjeta" + solicitud de cambios, y su almacén.

export function getContact(DB, qrId) {
  return DB.prepare('SELECT * FROM contacts WHERE qr_id = ?').bind(String(qrId)).first()
}

// ── Anti-spam (formularios públicos) ──
export const HONEYPOT = 'company_website' // campo oculto: si viene relleno, es bot

const cap = (s, n) => { const v = String(s ?? '').trim(); return v ? v.slice(0, n) : null }
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''))

/** ¿El envío disparó el honeypot? (humanos no rellenan el campo oculto). */
export function isHoneypotFilled(form) {
  return Boolean(form[HONEYPOT] && String(form[HONEYPOT]).trim())
}

/** Límite de envíos por IP en una ventana (anti-flood). */
export async function tooManyRequests(DB, ip, { max = 5, minutes = 10 } = {}) {
  if (!ip) return false
  const { results } = await DB.prepare(
    "SELECT COUNT(*) AS n FROM change_requests WHERE ip = ? AND created_at >= datetime('now', ?)",
  ).bind(String(ip), `-${minutes} minutes`).all()
  return (results[0]?.n ?? 0) >= max
}

export async function saveChangeRequest(DB, qrId, form, ip = null) {
  const id = `req_${nanoid(8)}`
  await DB.prepare(
    `INSERT INTO change_requests (id, kind, qr_id, full_name, company, job, email, phone, country, message, ip)
     VALUES (?, 'change', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id, String(qrId),
      cap(form.full_name, 120), cap(form.company, 120), cap(form.job, 120),
      cap(form.email, 160), cap(form.phone, 40), cap(form.country, 80), cap(form.message, 2000),
      ip,
    )
    .run()
  return { ok: true, id, kind: 'change' }
}

// Solicitud de una tarjeta NUEVA desde el formulario público (sin login).
export async function saveNewCardRequest(DB, form, ip = null) {
  const id = `req_${nanoid(8)}`
  // Si eligió "Other" en el dropdown, usamos el texto libre.
  const rawCompany = (form.company === 'Other' || !form.company) ? form.company_other : form.company
  await DB.prepare(
    `INSERT INTO change_requests (id, kind, qr_id, full_name, company, job, email, phone, country, message, ip)
     VALUES (?, 'new', NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      cap(form.full_name, 120), cap(rawCompany, 120), cap(form.job, 120),
      cap(form.email, 160), cap(form.phone, 40), cap(form.country, 80), cap(form.message, 2000),
      ip,
    )
    .run()
  return { ok: true, id, kind: 'new', company: cap(rawCompany, 120) }
}

export async function listChangeRequests(DB) {
  const { results } = await DB.prepare('SELECT * FROM change_requests ORDER BY created_at DESC').all()
  return results
}

export async function updateRequestStatus(DB, id, status) {
  await DB.prepare('UPDATE change_requests SET status = ? WHERE id = ?').bind(status, id).run()
  return { ok: true }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]))

const shell = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
<style>
  :root{--blue:#1f3e77;--ink:#16263d;--muted:#647890;--line:#dce6f0}
  *{box-sizing:border-box} body{margin:0;background:#eef3f8;font-family:'Segoe UI',Arial,sans-serif;color:var(--ink)}
  .wrap{max-width:560px;margin:0 auto;padding:24px 16px}
  .card{background:#fff;border-radius:14px;box-shadow:0 4px 20px rgba(22,38,61,.08);overflow:hidden}
  .head{background:var(--blue);color:#fff;padding:22px 26px}
  .logo{height:30px;display:block}
  .body{padding:24px 26px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;text-transform:uppercase;letter-spacing:.5px;color:var(--blue);margin:22px 0 8px}
  .muted{color:var(--muted)} .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px;gap:12px}
  .row b{color:var(--muted);font-weight:600} a.btn,button.btn{display:inline-block;background:var(--blue);color:#fff;border:none;text-decoration:none;font-size:15px;font-weight:700;padding:12px 22px;border-radius:10px;cursor:pointer}
  a.link{color:var(--blue)} label{display:block;font-size:13px;color:var(--muted);margin:10px 0 4px}
  input,textarea,select{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;font-family:inherit;background:#fff}
  .foot{background:#f5f9fd;border-top:1px solid var(--line);padding:16px 26px;color:var(--muted);font-size:12px}
</style></head><body><div class="wrap"><div class="card">
  <div class="head"><img class="logo" src="/biomar-logo.png" alt="BioMar"/></div>
  ${body}
  <div class="foot">Powered by Partnership. Driven by Innovation.<br/>BioMar — Digital Business Cards</div>
</div></div></body></html>`

export function reviewPageHtml(c) {
  const phone = c.mobile || c.phone
  const field = (label, name, value, type = 'text') =>
    `<label>${label}</label><input type="${type}" name="${name}" value="${esc(value)}"/>`
  return shell('Review your BioMar card', `
  <div class="body">
    <h1>Hi ${esc(c.full_name || 'there')},</h1>
    <p class="muted">Please review your digital business card details below — both your <b>Wallet card</b> and your <b>QR / vCard</b>. If anything is wrong, request a change at the bottom.</p>

    <h2>Your details</h2>
    <div class="row"><b>Name</b><span>${esc(c.full_name) || '—'}</span></div>
    <div class="row"><b>Company</b><span>${esc(c.company) || '—'}</span></div>
    <div class="row"><b>Job title</b><span>${esc(c.job) || '—'}</span></div>
    <div class="row"><b>Email</b><span>${esc(c.email) || '—'}</span></div>
    <div class="row"><b>Phone</b><span>${esc(phone) || '—'}</span></div>
    <div class="row"><b>Country</b><span>${esc(c.country) || '—'}</span></div>

    <h2>Open & check</h2>
    <p style="display:flex;gap:10px;flex-wrap:wrap">
      ${c.pass_url ? `<a class="btn" href="${esc(c.pass_url)}" target="_blank">Open Wallet card</a>` : ''}
      ${c.short_url ? `<a class="link" href="${esc(c.short_url)}" target="_blank" style="align-self:center">Open your QR / vCard ↗</a>` : ''}
    </p>

    <h2>Request a change</h2>
    <p class="muted">Edit anything that's incorrect and send it to us.</p>
    <form method="POST">
      <div style="position:absolute;left:-9999px;top:-9999px" aria-hidden="true">
        <label>Leave this field empty</label><input type="text" name="${HONEYPOT}" tabindex="-1" autocomplete="off"/>
      </div>
      ${field('Name', 'full_name', c.full_name)}
      ${field('Company', 'company', c.company)}
      ${field('Job title', 'job', c.job)}
      ${field('Email', 'email', c.email, 'email')}
      ${field('Phone', 'phone', phone)}
      <label>Notes / what to change</label><textarea name="message" rows="3" placeholder="Tell us what to update…"></textarea>
      <div style="margin-top:14px"><button class="btn" type="submit">Send change request</button></div>
    </form>
  </div>`)
}

// Formulario público (sin login) para solicitar una tarjeta nueva.
// `groups` es la lista de empresas/unidades (dropdown).
export function requestCardPageHtml(form = {}, errorMsg = '', groups = []) {
  const field = (label, name, type = 'text', required = false) =>
    `<label>${label}${required ? ' *' : ''}</label><input type="${type}" name="${name}" value="${esc(form[name])}"${required ? ' required' : ''}/>`
  const options = ['', ...groups, 'Other']
    .map((g) => g === ''
      ? '<option value="" disabled selected>Select your company / unit…</option>'
      : `<option value="${esc(g)}"${form.company === g ? ' selected' : ''}>${esc(g)}</option>`)
    .join('')
  return shell('Request your BioMar Digital Business Card', `
  <div class="body">
    <h1>Request your digital business card</h1>
    <p class="muted">Fill in your details and the BioMar team will create your digital business card (Wallet pass + QR / vCard) and email it to you.</p>
    ${errorMsg ? `<p style="color:#c0392b">${esc(errorMsg)}</p>` : ''}
    <form method="POST">
      <div style="position:absolute;left:-9999px;top:-9999px" aria-hidden="true">
        <label>Leave this field empty</label><input type="text" name="${HONEYPOT}" tabindex="-1" autocomplete="off"/>
      </div>
      ${field('Full name', 'full_name', 'text', true)}
      <label>Company / unit *</label>
      <select name="company" required>${options}</select>
      <label>If "Other", specify</label>
      <input type="text" name="company_other" value="${esc(form.company_other)}" placeholder="Your company / unit"/>
      ${field('Job title', 'job')}
      ${field('Work email', 'email', 'email', true)}
      ${field('Phone', 'phone', 'tel')}
      ${field('Country', 'country')}
      <label>Anything else? (optional)</label><textarea name="message" rows="3" placeholder="e.g. preferred name spelling, urgency…"></textarea>
      <div style="margin-top:14px"><button class="btn" type="submit">Request my card</button></div>
    </form>
  </div>`)
}

export function thankYouHtml(kind = 'change') {
  const msg = kind === 'new'
    ? 'We received your request. The BioMar team will create your digital business card and email it to you shortly.'
    : 'We received your change request. The BioMar team will review and update your digital card.'
  return shell('Thank you', `<div class="body">
    <h1>Thanks! ✅</h1>
    <p class="muted">${msg}</p>
  </div>`)
}

export function notFoundHtml() {
  return shell('Not found', `<div class="body">
    <h1>Card not found</h1>
    <p class="muted">This review link is not valid. Please contact the BioMar team.</p>
  </div>`)
}
