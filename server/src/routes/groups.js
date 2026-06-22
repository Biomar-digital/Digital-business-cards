import { Router } from 'express'
import { nanoid } from 'nanoid'
import { db } from '../db.js'

export const groupsRouter = Router()

groupsRouter.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM cards c WHERE c.group_id = g.id) AS card_count
       FROM groups g ORDER BY g.created_at DESC`,
    )
    .all()
  res.json(rows)
})

groupsRouter.post('/', (req, res) => {
  const { name, description } = req.body ?? {}
  if (!name) return res.status(400).json({ error: 'name es obligatorio' })
  const id = `grp_${nanoid(10)}`
  db.prepare('INSERT INTO groups (id, name, description) VALUES (?, ?, ?)').run(
    id,
    name,
    description ?? null,
  )
  res.status(201).json(db.prepare('SELECT * FROM groups WHERE id = ?').get(id))
})

groupsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id)
  res.status(204).end()
})
