import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function Dashboard() {
  const [cards, setCards] = useState([])
  const [groups, setGroups] = useState([])
  const [mode, setMode] = useState('')

  useEffect(() => {
    api.listCards().then(setCards).catch(() => {})
    api.listGroups().then(setGroups).catch(() => {})
    api.health().then((h) => setMode(h.mode)).catch(() => {})
  }, [])

  const active = cards.filter((c) => c.status === 'active').length
  const errors = cards.filter((c) => c.status === 'error').length

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <Link className="btn" to="/new">➕ Nueva tarjeta</Link>
      </div>
      {mode === 'mock' && (
        <p className="muted" style={{ marginTop: -10 }}>
          ⚠️ Modo <b>mock</b>: las tarjetas y QR son simulados. Configura las API keys
          y <code>PROVIDER_MODE=live</code> para usar los proveedores reales.
        </p>
      )}
      <div className="cards-grid">
        <div className="stat"><div className="num">{cards.length}</div><div className="label">Tarjetas</div></div>
        <div className="stat"><div className="num">{active}</div><div className="label">Activas</div></div>
        <div className="stat"><div className="num">{groups.length}</div><div className="label">Grupos</div></div>
        <div className="stat"><div className="num" style={{ color: errors ? 'var(--red)' : undefined }}>{errors}</div><div className="label">Con error</div></div>
      </div>

      <h2 style={{ marginTop: 32, fontSize: 16 }}>Últimas tarjetas</h2>
      {cards.length === 0 ? (
        <div className="empty">Aún no hay tarjetas. Crea la primera.</div>
      ) : (
        <table>
          <thead><tr><th>Nombre</th><th>Empresa</th><th>Estado</th><th>QR</th></tr></thead>
          <tbody>
            {cards.slice(0, 8).map((c) => (
              <tr key={c.id}>
                <td><Link to={`/cards/${c.id}`}>{c.full_name}</Link></td>
                <td className="muted">{c.company || '—'}</td>
                <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                <td className="muted">{c.qr_short_url ? <a href={c.qr_short_url} target="_blank" rel="noreferrer">{c.qr_short_url}</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
