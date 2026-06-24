import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { nanoid } from 'nanoid'
import * as cards from './lib/cards.js'
import { getConfig } from './lib/config.js'
import * as contacts from './lib/contacts.js'
import { ensureSchema } from './lib/db.js'
import { listUnifiedGroups } from './lib/groups.js'
import { introEmailHtml, sendAdminNotification } from './lib/email.js'
import * as review from './lib/review.js'
import * as wallet from './lib/providers/addToWallet.js'
import * as qr from './lib/providers/qrCode.js'

// ── API (todo lo que cuelga de /api) ──
const api = new Hono().basePath('/api')

api.use('*', cors())

// Auth simple por token (cabecera x-admin-token). Si ADMIN_TOKEN está vacío
// (desarrollo), no se exige.
api.use('*', async (c, next) => {
  const cfg = getConfig(c.env)
  if (!cfg.adminToken) return next()
  // Token por cabecera (el panel) o por query param (para abrir URLs de
  // diagnóstico como /api/qr/raw?token=... directamente en el navegador).
  if (c.req.header('x-admin-token') === cfg.adminToken) return next()
  if (c.req.query('token') === cfg.adminToken) return next()
  return c.json({ error: 'No autorizado' }, 401)
})

// Crea las tablas en D1 la primera vez (idempotente).
api.use('*', async (c, next) => {
  await ensureSchema(c.env.DB)
  return next()
})

api.get('/health', (c) => c.json({ ok: true, mode: getConfig(c.env).providerMode }))

// ── Tarjetas ──
api.get('/cards', async (c) => {
  return c.json(await cards.listCards(c.env.DB, c.req.query('groupId')))
})

api.get('/cards/:id', async (c) => {
  const card = await cards.getCard(c.env.DB, c.req.param('id'))
  if (!card) return c.json({ error: 'No encontrada' }, 404)
  return c.json({ ...card, logs: await cards.getCardLogs(c.env.DB, card.id) })
})

api.post('/cards', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (!body.fullName) return c.json({ error: 'fullName es obligatorio' }, 400)
  const card = await cards.createCard(getConfig(c.env), c.env.DB, body, {
    sendEmail: Boolean(body.sendEmail),
  })
  return c.json(card, 201)
})

api.post('/cards/:id/send', async (c) => {
  await cards.sendCard(getConfig(c.env), c.env.DB, c.req.param('id'))
  return c.json({ ok: true })
})

api.get('/cards/:id/analytics', async (c) => {
  return c.json(await cards.getCardAnalytics(getConfig(c.env), c.env.DB, c.req.param('id')))
})

api.delete('/cards/:id', async (c) => {
  await cards.deleteCard(getConfig(c.env), c.env.DB, c.req.param('id'))
  return c.body(null, 204)
})

// ── Grupos ──
api.get('/groups', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.*, (SELECT COUNT(*) FROM cards x WHERE x.group_id = g.id) AS card_count
     FROM groups g ORDER BY g.created_at DESC`,
  ).all()
  return c.json(results)
})

api.post('/groups', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (!body.name) return c.json({ error: 'name es obligatorio' }, 400)
  const id = `grp_${nanoid(10)}`
  await c.env.DB.prepare('INSERT INTO groups (id, name, description) VALUES (?, ?, ?)')
    .bind(id, body.name, body.description ?? null)
    .run()
  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first()
  return c.json(group, 201)
})

api.delete('/groups/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(c.req.param('id')).run()
  return c.body(null, 204)
})

// ── QR de la cuenta (qr-code-generator) ──
api.get('/qr', async (c) => c.json(await qr.listQrCodes(getConfig(c.env))))
// Respuesta cruda, para calibrar el mapeo contra la API real.
api.get('/qr/raw', async (c) => c.json(await qr.listQrCodesRaw(getConfig(c.env))))
// Detalle de una vCard de ejemplo (para descubrir todos los campos).
api.get('/qr/detail-sample', async (c) => c.json(await qr.sampleVcardDetail(getConfig(c.env))))
// Inspección de la landing del vCard (para extraer el contacto / .vcf).
api.get('/qr/vcard-page', async (c) => c.json(await qr.inspectVcardPage(getConfig(c.env))))

// ── Pases de la cuenta (AddToWallet) ──
api.get('/passes', async (c) => c.json(await wallet.listPasses(getConfig(c.env))))
api.get('/passes/raw', async (c) => c.json(await wallet.listPassesRaw(getConfig(c.env))))
api.get('/passes/debug', async (c) => c.json(await wallet.debugList(getConfig(c.env))))

// ── Directorio de personas (contactos extraídos de las vCards) ──
api.get('/people', async (c) => c.json(await contacts.listContacts(c.env.DB)))
api.post('/people/index', async (c) => c.json(await contacts.indexPeople(getConfig(c.env), c.env.DB)))
api.post('/people/sync', async (c) => c.json(await contacts.syncBatch(getConfig(c.env), c.env.DB)))
api.post('/people/reset', async (c) => c.json(await contacts.resetSync(c.env.DB)))

// ── Solicitudes de cambio (de la página pública de revisión) ──
api.get('/requests', async (c) => c.json(await review.listChangeRequests(c.env.DB)))
api.post('/requests/:id/status', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  return c.json(await review.updateRequestStatus(c.env.DB, c.req.param('id'), body.status || 'done'))
})
api.post('/people/passes', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  return c.json(
    await contacts.createPassesBatch(getConfig(c.env), c.env.DB, body.qrIds || [], {
      sendEmail: Boolean(body.sendEmail),
    }),
  )
})
// Envía/reenvía el email de intro a las personas indicadas (con pase + email).
api.post('/people/send-email', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  return c.json(await contacts.sendIntroEmails(getConfig(c.env), c.env.DB, body.qrIds || []))
})
// Vincula pases ya existentes en AddToWallet con las personas del directorio.
api.post('/people/link-passes', async (c) => c.json(await contacts.linkExistingPasses(getConfig(c.env), c.env.DB)))

// ── PRUEBA: crear el QR (el wallet pass ya está confirmado) ──
api.post('/test/create-card', async (c) => {
  const cfg = getConfig(c.env)
  const qrRes = await qr.createTestVcardQr(cfg)
  return c.json({ qr: qrRes })
})

// ── PRUEBA: crear un pase de EJEMPLO con el template real (para mockups) ──
api.post('/test/create-pass', async (c) => c.json(await wallet.createExamplePass(getConfig(c.env))))

// ── Plantillas dinámicas (AddToWallet) ──
api.get('/templates', async (c) => c.json(await wallet.listTemplates(getConfig(c.env))))
api.get('/templates/raw', async (c) => c.json(await wallet.listTemplatesRaw(getConfig(c.env))))

// Descubrimiento de la API de AddToWallet (lee spec + prueba rutas/auth).
api.get('/_discover', async (c) => c.json(await wallet.discover(getConfig(c.env))))

api.onError((err, c) => {
  console.error(err)
  return c.json({ error: String(err.message ?? err) }, 500)
})

// ── Worker: enruta /api al backend y el resto al panel estático (SPA) ──
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api')) {
      return api.fetch(request, env, ctx)
    }
    // Preview público del email de introducción (para iterar el diseño).
    if (url.pathname === '/email-preview') {
      // Preview coherente: el nombre y el pase de ejemplo son la MISMA persona (Alex).
      const name = url.searchParams.get('name') || 'Alex Johansen'
      // Pase REAL de ejemplo (shareUrl /card/<id>) para que el botón del preview funcione.
      const passUrl = url.searchParams.get('passUrl') || 'https://app.addtowallet.co/card/6a3ba4ca4383656b97f5fd48'
      return new Response(
        introEmailHtml({ name, passUrl, reviewUrl: `${url.origin}/review/EXAMPLE`, base: url.origin }),
        { headers: { 'content-type': 'text/html; charset=utf-8' } },
      )
    }
    const html = (h, status = 200) => new Response(h, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

    // Formulario público (sin login) para SOLICITAR una tarjeta nueva.
    if (url.pathname === '/request') {
      await ensureSchema(env.DB)
      const groups = await listUnifiedGroups(env.DB)
      if (request.method === 'POST') {
        const form = Object.fromEntries([...(await request.formData()).entries()])
        if (!form.full_name || !form.email) {
          return html(review.requestCardPageHtml(form, 'Name and email are required.', groups), 400)
        }
        const saved = await review.saveNewCardRequest(env.DB, form)
        try {
          await sendAdminNotification(getConfig(env), { kind: 'new', data: { ...form, company: saved.company } })
        } catch (e) { console.error('notify failed', e) }
        return html(review.thankYouHtml('new'))
      }
      return html(review.requestCardPageHtml({}, '', groups))
    }

    // Página pública de revisión / solicitud de cambios.
    if (url.pathname.startsWith('/review/')) {
      const id = decodeURIComponent(url.pathname.split('/')[2] || '')
      await ensureSchema(env.DB)
      if (id === 'EXAMPLE') {
        return html(review.reviewPageHtml({ full_name: 'Alex Johansen', company: 'BioMar Group', job: 'BioMar Employee', email: 'alex.johansen@biomar.com', mobile: '+45 25 50 50 10', country: 'Denmark', pass_url: 'https://app.addtowallet.co/card/6a3ba4ca4383656b97f5fd48', short_url: 'https://qrco.de/bgp5bV' }))
      }
      const contact = await review.getContact(env.DB, id)
      if (!contact) return html(review.notFoundHtml(), 404)
      if (request.method === 'POST') {
        const form = Object.fromEntries([...(await request.formData()).entries()])
        await review.saveChangeRequest(env.DB, id, form)
        try {
          await sendAdminNotification(getConfig(env), { kind: 'change', data: { ...form, country: contact.country } })
        } catch (e) { console.error('notify failed', e) }
        return html(review.thankYouHtml('change'))
      }
      return html(review.reviewPageHtml(contact))
    }
    // Servir el panel compilado (web/dist) vía el binding ASSETS. Para rutas
    // del cliente (react-router) que no son un fichero, devolvemos index.html.
    const res = await env.ASSETS.fetch(request)
    if (res.status === 404) {
      return env.ASSETS.fetch(new URL('/index.html', url.origin))
    }
    return res
  },
}
