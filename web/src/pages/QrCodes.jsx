import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function QrCodes() {
  const [qrs, setQrs] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [raw, setRaw] = useState(null)

  useEffect(() => {
    api.listQr().then(setQrs).catch((e) => setError(String(e.message || e)))
  }, [])

  const list = (qrs || []).filter((x) =>
    !q || `${x.name} ${x.company || ''}`.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <>
      <div className="page-head">
        <h1>QR codes ({qrs ? qrs.length : '…'})</h1>
        <input
          placeholder="Search by name or company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 260 }}
        />
      </div>
      <p className="muted" style={{ marginTop: -10 }}>
        All dynamic QR codes from the qr-code-generator account.{' '}
        <button
          className="btn secondary"
          style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => api.qrRaw().then(setRaw).catch((e) => setRaw({ error: String(e.message || e) }))}
        >
          Inspect raw data
        </button>
      </p>

      {raw && (
        <div className="card" style={{ marginBottom: 14 }}>
          <b>Raw QR data (to locate the company field):</b>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, maxHeight: 260, overflow: 'auto', marginBottom: 0 }}>
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      )}

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {!qrs && !error && <div className="empty">Loading…</div>}
      {qrs && list.length === 0 && <div className="empty">No QR codes.</div>}

      {list.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>QR</th><th>Name</th><th>Company</th><th>Scans</th><th>Short URL</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td>{x.imageUrl ? <img className="qr-thumb" src={x.imageUrl} alt="" /> : '—'}</td>
                <td>{x.name}</td>
                <td className="muted">{x.company || '—'}</td>
                <td><b>{x.scans}</b></td>
                <td>{x.shortUrl ? <a href={x.shortUrl} target="_blank" rel="noreferrer">{x.shortUrl}</a> : '—'}</td>
                <td className="muted">{x.createdAt ? String(x.createdAt).slice(0, 10) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
