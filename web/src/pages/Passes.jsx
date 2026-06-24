import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Passes() {
  const [passes, setPasses] = useState(null)
  const [error, setError] = useState('')
  const [debug, setDebug] = useState(null)
  const [q, setQ] = useState('')
  const [example, setExample] = useState(null)
  const [creating, setCreating] = useState(false)

  async function makeExample() {
    setCreating(true)
    setExample(null)
    try {
      setExample(await api.createExamplePass())
    } catch (e) {
      setExample({ error: String(e.message || e) })
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    api.listPasses().then(setPasses).catch((e) => {
      setError(String(e.message || e))
      // Al fallar, traemos la respuesta cruda de la API para diagnosticar.
      api.passesDebug().then(setDebug).catch(() => {})
    })
  }, [])

  const list = (passes || []).filter((x) =>
    !q || (x.name || '').toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <>
      <div className="page-head">
        <h1>Wallet passes ({passes ? passes.length : '…'})</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={makeExample} disabled={creating}>
            {creating ? 'Creating…' : 'Create example pass'}
          </button>
          <input
            placeholder="Search by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 240 }}
          />
        </div>
      </div>
      <p className="muted" style={{ marginTop: -10 }}>
        All Apple/Google Wallet passes from the AddToWallet account.
      </p>

      {example && (
        <div className="card" style={{ marginTop: 12, borderColor: example.error ? 'var(--red)' : undefined }}>
          {example.error ? (
            <>⚠️ {example.error}</>
          ) : (
            <>
              <b>Example pass created with the real template</b> — open it and take a screenshot:
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                {example.passUrl && (
                  <a href={example.passUrl} target="_blank" rel="noreferrer"><b>Open pass (public link) ↗</b></a>
                )}
                {example.passGeneratorUrl && (
                  <a href={example.passGeneratorUrl} target="_blank" rel="noreferrer" className="muted">Editor (dashboard) ↗</a>
                )}
                {example.cardId && <span className="muted">id: {example.cardId}</span>}
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, marginBottom: 0, marginTop: 10 }}>
                {JSON.stringify(example, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {debug && (
        <div className="card" style={{ marginTop: 12 }}>
          <b>Diagnóstico de la API (respuesta cruda):</b>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, marginBottom: 0 }}>
            {JSON.stringify(debug, null, 2)}
          </pre>
        </div>
      )}
      {!passes && !error && <div className="empty">Loading…</div>}
      {passes && list.length === 0 && <div className="empty">No passes.</div>}

      {list.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Job title</th><th>Business</th><th>Email</th><th>Phone</th><th>Status</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td>{x.name}</td>
                <td className="muted">{x.title || '—'}</td>
                <td className="muted">{x.business || '—'}</td>
                <td className="muted">{x.email || '—'}</td>
                <td className="muted">{x.phone || '—'}</td>
                <td>{x.status ? <span className={`badge ${x.status === 'ACTIVE' ? 'active' : 'draft'}`}>{x.status.toLowerCase()}</span> : '—'}</td>
                <td className="muted">{x.createdAt ? String(x.createdAt).slice(0, 10) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
