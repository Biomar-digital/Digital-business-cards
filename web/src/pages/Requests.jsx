import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Requests() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  const load = () => api.listRequests().then(setItems).catch((e) => setError(String(e.message || e)))
  useEffect(() => { load() }, [])

  async function resolve(id) {
    await api.resolveRequest(id)
    load()
  }

  const open = (items || []).filter((r) => r.status !== 'done')

  return (
    <>
      <div className="page-head"><h1>Change requests ({open.length} open)</h1></div>
      <p className="muted" style={{ marginTop: -10 }}>
        Corrections submitted by people from the "Review my info" link in their email.
      </p>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {items && items.length === 0 && <div className="empty">No change requests yet.</div>}

      {items && items.length > 0 && (
        <table>
          <thead>
            <tr><th>Date</th><th>Name</th><th>Company</th><th>Job</th><th>Email</th><th>Phone</th><th>Message</th><th>Status</th></tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} style={{ opacity: r.status === 'done' ? 0.5 : 1 }}>
                <td className="muted">{String(r.created_at).slice(0, 16)}</td>
                <td>{r.full_name || '—'}</td>
                <td className="muted">{r.company || '—'}</td>
                <td className="muted">{r.job || '—'}</td>
                <td className="muted">{r.email || '—'}</td>
                <td className="muted">{r.phone || '—'}</td>
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
