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
        <Link className="btn" to="/new">New card</Link>
      </div>
      {mode === 'mock' && (
        <p className="muted" style={{ marginTop: -10 }}>
          <b>Mock mode</b>: passes and QR codes are simulated. Set the API keys and
          {' '}<code>PROVIDER_MODE=live</code> to use the real providers.
        </p>
      )}
      <div className="cards-grid">
        <div className="stat"><div className="num">{cards.length}</div><div className="label">Cards</div></div>
        <div className="stat"><div className="num">{active}</div><div className="label">Active</div></div>
        <div className="stat"><div className="num">{groups.length}</div><div className="label">Groups</div></div>
        <div className="stat"><div className="num" style={{ color: errors ? 'var(--red)' : undefined }}>{errors}</div><div className="label">With errors</div></div>
      </div>

      <h2 style={{ marginTop: 32, fontSize: 16 }}>Latest cards</h2>
      {cards.length === 0 ? (
        <div className="empty">No cards yet. Create the first one.</div>
      ) : (
        <table>
          <thead><tr><th>Name</th><th>Company</th><th>Status</th><th>QR</th></tr></thead>
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
