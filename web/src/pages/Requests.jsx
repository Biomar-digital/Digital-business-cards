import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Requests() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('open') // open | all

  const load = () => api.listRequests().then(setItems).catch((e) => setError(String(e.message || e)))
  useEffect(() => { load() }, [])

  async function resolve(id) {
    await api.resolveRequest(id)
    load()
  }

  const all = items || []
  const open = all.filter((r) => r.status !== 'done')
  const newCards = open.filter((r) => r.kind === 'new')
  const changes = open.filter((r) => r.kind !== 'new')
  const shown = filter === 'open' ? open : all
  const requestUrl = `${window.location.origin}/request`

  return (
    <>
      <div className="page-head">
        <h1>Notifications ({open.length} open)</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="open">Open only</option>
          <option value="all">All</option>
        </select>
      </div>
      <p className="muted" style={{ marginTop: -10 }}>
        {newCards.length} new-card request{newCards.length === 1 ? '' : 's'} · {changes.length} change request{changes.length === 1 ? '' : 's'}.
      </p>

      <div className="card" style={{ marginBottom: 14 }}>
        <b>Public request form</b> — share this link so anyone can request a card without logging in:
        <div style={{ marginTop: 6 }}>
          <a href={requestUrl} target="_blank" rel="noreferrer">{requestUrl}</a>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {items && shown.length === 0 && <div className="empty">No {filter === 'open' ? 'open ' : ''}requests.</div>}

      {shown.length > 0 && (
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Name</th><th>Company</th><th>Job</th><th>Email</th><th>Phone</th><th>Country</th><th>Message</th><th>Status</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} style={{ opacity: r.status === 'done' ? 0.5 : 1 }}>
                <td className="muted">{String(r.created_at).slice(0, 16)}</td>
                <td>
                  {r.kind === 'new'
                    ? <span className="badge active">new card</span>
                    : <span className="badge draft">change</span>}
                </td>
                <td>{r.full_name || '—'}</td>
                <td className="muted">{r.company || '—'}</td>
                <td className="muted">{r.job || '—'}</td>
                <td className="muted">{r.email || '—'}</td>
                <td className="muted">{r.phone || '—'}</td>
                <td className="muted">{r.country || '—'}</td>
                <td className="muted" style={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{r.message || '—'}</td>
                <td>
                  {r.status === 'done'
                    ? <span className="badge active">done</span>
                    : <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => resolve(r.id)}>Mark done</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
