import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Passes() {
  const [passes, setPasses] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    api.listPasses().then(setPasses).catch((e) => setError(String(e.message || e)))
  }, [])

  const list = (passes || []).filter((x) =>
    !q || (x.name || '').toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <>
      <div className="page-head">
        <h1>Wallet passes ({passes ? passes.length : '…'})</h1>
        <input
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 240 }}
        />
      </div>
      <p className="muted" style={{ marginTop: -10 }}>
        All Apple/Google Wallet passes from the AddToWallet account.
      </p>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {!passes && !error && <div className="empty">Loading…</div>}
      {passes && list.length === 0 && <div className="empty">No passes.</div>}

      {list.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Template</th><th>Install</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td>{x.name}</td>
                <td className="muted">{x.email || '—'}</td>
                <td className="muted ellipsis">{x.template || '—'}</td>
                <td>{x.installUrl ? <a href={x.installUrl} target="_blank" rel="noreferrer">Open pass</a> : '—'}</td>
                <td className="muted">{x.createdAt || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
