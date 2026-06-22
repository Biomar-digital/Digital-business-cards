import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

export default function QrCodes() {
  const [qrs, setQrs] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [peopleOnly, setPeopleOnly] = useState(true)
  const [folder, setFolder] = useState('')
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    api.listQr().then(setQrs).catch((e) => setError(String(e.message || e)))
  }, [])

  // Carpetas (grupos) presentes, con conteo.
  const folders = useMemo(() => {
    const m = new Map()
    for (const x of qrs || []) {
      if (peopleOnly && !x.isPerson) continue
      const key = String(x.folder ?? '')
      const label = x.folderName || `Folder ${x.folder ?? '—'}`
      const e = m.get(key) || { key, label, count: 0 }
      e.count++
      m.set(key, e)
    }
    return [...m.values()].sort((a, b) => b.count - a.count)
  }, [qrs, peopleOnly])

  const list = (qrs || [])
    .filter((x) => !peopleOnly || x.isPerson)
    .filter((x) => folder === '' || String(x.folder ?? '') === folder)
    .filter((x) => !q || (x.name || '').toLowerCase().includes(q.toLowerCase()))

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
        Dynamic QR codes from qr-code-generator, grouped by folder. vCard codes are people.
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label style={{ marginBottom: 4 }}>Group (folder)</label>
          <select value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">All groups</option>
            {folders.map((f) => (
              <option key={f.key} value={f.key}>{f.label} ({f.count})</option>
            ))}
          </select>
        </div>
        <label className="checkbox" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={peopleOnly} onChange={(e) => setPeopleOnly(e.target.checked)} />
          Only people (vCard)
        </label>
        <button
          className="btn secondary"
          style={{ marginTop: 18 }}
          onClick={() => api.qrVcardPage().then(setDetail).catch((e) => setDetail({ error: String(e.message || e) }))}
        >
          Inspect vCard page
        </button>
      </div>

      {detail && (
        <div className="card" style={{ marginBottom: 14 }}>
          <b>vCard detail (to map all fields like company, email, phone):</b>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, maxHeight: 320, overflow: 'auto', marginBottom: 0 }}>
            {JSON.stringify(detail, null, 2)}
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
              <th>QR</th><th>Name</th><th>Type</th><th>Group (folder)</th><th>Scans</th><th>Short URL</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td>{x.imageUrl ? <img className="qr-thumb" src={x.imageUrl} alt="" /> : '—'}</td>
                <td>{x.name}</td>
                <td className="muted">{x.type || '—'}</td>
                <td className="muted">{x.folderName || (x.folder != null ? `Folder ${x.folder}` : '—')}</td>
                <td><b>{x.scans}</b>{x.uniqueScans != null ? <span className="muted"> ({x.uniqueScans})</span> : null}</td>
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
