import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { nanoid } from 'nanoid'
import * as cards from '../_lib/cards.js'
import { getConfig } from '../_lib/config.js'

const app = new Hono().basePath('/api')

app.use('*', cors())

// Auth simple por token (cabecera x-admin-token). Si ADMIN_TOKEN está vacío
// (desarrollo), no se exige.
app.use('*', async (c, next) => {
  const cfg = getConfig(c.env)
  if (!cfg.adminToken) return next()
  if (c.req.header('x-admin-token') === cfg.adminToken) return next()
  return c.json({ error: 'No autorizado' }, 401)
})

app.get('/health', (c) => c.json({ ok: true, mode: getConfig(c.env).providerMode }))

// ── Tarjetas ──
app.get('/cards', async (c) => {
  const groupId = c.req.query('groupId')
  return c.json(await cards.listCards(c.env.DB, groupId))
})

app.get('/cards/:id', async (c) => {
  const card = await cards.getCard(c.env.DB, c.req.param('id'))
  if (!card) return c.json({ error: 'No encontrada' }, 404)
  return c.json({ ...card, logs: await cards.getCardLogs(c.env.DB, card.id) })
})

app.post('/cards', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (!body.fullName) return c.json({ error: 'fullName es obligatorio' }, 400)
  const card = await cards.createCard(getConfig(c.env), c.env.DB, body, {
    sendEmail: Boolean(body.sendEmail),
  })
  return c.json(card, 201)
})

app.post('/cards/:id/send', async (c) => {
  await cards.sendCard(getConfig(c.env), c.env.DB, c.req.param('id'))
  return c.json({ ok: true })
})

app.get('/cards/:id/analytics', async (c) => {
  return c.json(await cards.getCardAnalytics(getConfig(c.env), c.env.DB, c.req.param('id')))
})

app.delete('/cards/:id', async (c) => {
  await cards.deleteCard(getConfig(c.env), c.env.DB, c.req.param('id'))
  return c.body(null, 204)
})

// ── Grupos ──
app.get('/groups', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.*, (SELECT COUNT(*) FROM cards x WHERE x.group_id = g.id) AS card_count
     FROM groups g ORDER BY g.created_at DESC`,
  ).all()
  return c.json(results)
})

app.post('/groups', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (!body.name) return c.json({ error: 'name es obligatorio' }, 400)
  const id = `grp_${nanoid(10)}`
  await c.env.DB.prepare('INSERT INTO groups (id, name, description) VALUES (?, ?, ?)')
    .bind(id, body.name, body.description ?? null)
    .run()
  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first()
  return c.json(group, 201)
})

app.delete('/groups/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(c.req.param('id')).run()
  return c.body(null, 204)
})

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: String(err.message ?? err) }, 500)
})

// Punto de entrada de Cloudflare Pages Functions.
export const onRequest = (context) => app.fetch(context.request, context.env, context)
