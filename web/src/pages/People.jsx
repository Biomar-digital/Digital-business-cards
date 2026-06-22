import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

export default function People() {
  const [people, setPeople] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [company, setCompany] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => api.listPeople().then(setPeople).catch((e) => setError(String(e.message || e)))
  useEffect(() => { load() }, [])

  async function sync(force) {
    setBusy(true)
    setMsg('')
    try {
      const r = await api.syncPeople(force)
      setMsg(`Synced ${r.synced} · ${r.remaining} remaining of ${r.totalPeople}`)
      await load()
    } catch (e) {
      setMsg('Error: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const companies = useMemo(() => {
    const m = new Map()
    for (const p of people || []) {
      const key = p.company || '—'
      m.set(key, (m.get(key) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [people])

  const list = (people || [])
    .filter((p) => company === '' || (p.company || '—') === company)
    .filter((p) => !q || `${p.full_name} ${p.email} ${p.company}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <div className="page-head">
        <h1>People ({people ? people.length : '…'})</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" disabled={busy} onClick={() => sync(false)}>
            {busy ? 'Syncing…' : 'Sync from QR'}
          </button>
          <button className="btn secondary" disabled={busy} onClick={() => sync(true)} title="Re-fetch all">
            Resync all
          </button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -10 }}>
        Contacts extracted from the vCard QR codes, grouped by company. {msg && <b>{msg}</b>}
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 240 }}>
          <label style={{ marginBottom: 4 }}>Company</label>
          <select value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">All companies</option>
            {companies.map(([name, count]) => (
              <option key={name} value={name}>{name} ({count})</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 200 }}>
          <label style={{ marginBottom: 4 }}>Search</label>
          <input placeholder="name, email, company…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {people && people.length === 0 && !error && (
        <div className="empty">No contacts yet. Click <b>Sync from QR</b> to extract them from your vCard QR codes.</div>
      )}

      {list.length > 0 && (
        <table>
          <thead>
            <tr><th>Name</th><th>Company</th><th>Job</th><th>Email</th><th>Phone</th><th>Country</th><th>Scans</th></tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.qr_id}>
                <td>{p.full_name || '—'}</td>
                <td>{p.company || '—'}</td>
                <td className="muted">{p.job || '—'}</td>
                <td className="muted">{p.email || '—'}</td>
                <td className="muted">{p.mobile || p.phone || '—'}</td>
                <td className="muted">{p.country || '—'}</td>
                <td><b>{p.total_scans ?? 0}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
