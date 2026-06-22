import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Templates() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listTemplates().then(setItems).catch((e) => setError(String(e.message || e)))
  }, [])

  return (
    <>
      <div className="page-head">
        <h1>Templates ({items ? items.length : '…'})</h1>
      </div>
      <p className="muted" style={{ marginTop: -10 }}>
        Dynamic pass templates from the AddToWallet account. Each template has a linked user group.
      </p>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {!items && !error && <div className="empty">Loading…</div>}
      {items && items.length === 0 && <div className="empty">No templates.</div>}

      {items && items.length > 0 && (
        <table>
          <thead>
            <tr><th>Name</th><th>Business</th><th>Template ID</th><th>Group ID</th><th>Created</th></tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="muted">{t.cardTitle || '—'}</td>
                <td className="muted ellipsis">{t.id || '—'}</td>
                <td className="muted ellipsis">{t.groupId || '—'}</td>
                <td className="muted">{t.createdAt ? String(t.createdAt).slice(0, 10) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
