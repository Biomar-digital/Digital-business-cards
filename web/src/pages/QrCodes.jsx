import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function QrCodes() {
  const [qrs, setQrs] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    api.listQr().then(setQrs).catch((e) => setError(String(e.message || e)))
  }, [])

  const list = (qrs || []).filter((x) =>
    !q || (x.name || '').toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <>
      <div className="page-head">
        <h1>QR codes ({qrs ? qrs.length : '…'})</h1>
        <input
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 240 }}
        />
      </div>
      <p className="muted" style={{ marginTop: -10 }}>
        All dynamic QR codes from the qr-code-generator account.
      </p>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {!qrs && !error && <div className="empty">Loading…</div>}
      {qrs && list.length === 0 && <div className="empty">No QR codes.</div>}

      {list.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>QR</th><th>Name</th><th>Scans</th><th>Short URL</th><th>Target</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td>{x.imageUrl ? <img className="qr-thumb" src={x.imageUrl} alt="" /> : '—'}</td>
                <td>{x.name}</td>
                <td><b>{x.scans}</b></td>
                <td>{x.shortUrl ? <a href={x.shortUrl} target="_blank" rel="noreferrer">{x.shortUrl}</a> : '—'}</td>
                <td className="muted ellipsis">{x.targetUrl ? <a href={x.targetUrl} target="_blank" rel="noreferrer">{x.targetUrl}</a> : '—'}</td>
                <td className="muted">{x.createdAt || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
