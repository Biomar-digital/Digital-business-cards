import { Router } from 'express'
import {
  createCard,
  deleteCard,
  getCard,
  getCardAnalytics,
  getCardLogs,
  listCards,
  sendCard,
} from '../services/cardService.js'

export const cardsRouter = Router()

function wrap(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error(err)
      res.status(500).json({ error: String(err.message ?? err) })
    })
  }
}

cardsRouter.get('/', (req, res) => {
  res.json(listCards({ groupId: req.query.groupId }))
})

cardsRouter.get('/:id', (req, res) => {
  const card = getCard(req.params.id)
  if (!card) return res.status(404).json({ error: 'No encontrada' })
  res.json({ ...card, logs: getCardLogs(card.id) })
})

cardsRouter.post(
  '/',
  wrap(async (req, res) => {
    const { fullName } = req.body ?? {}
    if (!fullName) return res.status(400).json({ error: 'fullName es obligatorio' })
    const card = await createCard(req.body, { sendEmail: Boolean(req.body.sendEmail) })
    res.status(201).json(card)
  }),
)

cardsRouter.post(
  '/:id/send',
  wrap(async (req, res) => {
    await sendCard(req.params.id)
    res.json({ ok: true })
  }),
)

cardsRouter.get(
  '/:id/analytics',
  wrap(async (req, res) => {
    res.json(await getCardAnalytics(req.params.id))
  }),
)

cardsRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    await deleteCard(req.params.id)
    res.status(204).end()
  }),
)
