import cors from 'cors'
import express from 'express'
import { assertLiveConfig, config, isLive } from './config.js'
import './db.js'
import { cardsRouter } from './routes/cards.js'
import { groupsRouter } from './routes/groups.js'

if (isLive) assertLiveConfig()

const app = express()
app.use(cors())
app.use(express.json())

// Auth simple por token (cabecera x-admin-token). Si ADMIN_TOKEN está vacío
// (desarrollo), no se exige.
app.use('/api', (req, res, next) => {
  if (!config.adminToken) return next()
  if (req.get('x-admin-token') === config.adminToken) return next()
  res.status(401).json({ error: 'No autorizado' })
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mode: config.providerMode })
})

app.use('/api/cards', cardsRouter)
app.use('/api/groups', groupsRouter)

app.listen(config.port, () => {
  console.log(`API escuchando en http://localhost:${config.port} (modo: ${config.providerMode})`)
})
