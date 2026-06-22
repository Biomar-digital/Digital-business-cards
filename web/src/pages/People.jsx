import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const ALL = ''

export default function People() {
  const [people, setPeople] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [company, setCompany] = useState(ALL)
  const [country, setCountry] = useState(ALL)
  const [group, setGroup] = useState(ALL)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [test, setTest] = useState(null)

  async function createTest() {
    setTest({ loading: true })
    try {
      setTest(await api.createTestCard())
    } catch (e) {
      setTest({ error: String(e.message || e) })
    }
  }

  const load = () => api.listPeople().then(setPeople).catch((e) => setError(String(e.message || e)))
  useEffect(() => { load() }, [])

  // Indexa todas las vCards y luego baja las landings por lotes hasta terminar.
  async function sync(reset) {
    setBusy(true)
    setMsg('Indexing…')
    try {
      if (reset) await api.resetPeople()
      const idx = await api.indexPeople()
      let remaining = idx.pending
      let done = 0
      for (let i = 0; i < 50; i++) {
        const r = await api.syncPeople()
        done += r.synced
        remaining = r.remaining
        setMsg(`Synced ${done}… ${remaining} remaining`)
        await load()
        if (remaining === 0 || r.synced === 0) break
      }
      setMsg(`Done. ${done} synced, ${remaining} remaining.`)
    } catch (e) {
      setMsg('Error: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  // Opciones de cada filtro, con conteo, respetando los OTROS filtros activos.
  const facet = (field, ignore) => {
    const m = new Map()
    for (const p of people || []) {
      if (field !== 'company' && company && (p.company || '—') !== company) continue
      if (field !== 'country' && country && (p.country || '—') !== country) continue
      if (field !== 'group' && group && (p.folder_name || p.folder_id || '—') !== group) continue
      const key =
        field === 'company' ? (p.company || '—')
          : field === 'country' ? (p.country || '—')
            : (p.folder_name || p.folder_id || '—')
      m.set(key, (m.get(key) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const companies = useMemo(() => facet('company'), [people, country, group])
  const countries = useMemo(() => facet('country'), [people, company, group])
  const groups = useMemo(() => facet('group'), [people, company, country])

  const list = (people || [])
    .filter((p) => company === ALL || (p.company || '—') === company)
    .filter((p) => country === ALL || (p.country || '—') === country)
    .filter((p) => group === ALL || (p.folder_name || p.folder_id || '—') === group)
    .filter((p) => !q || `${p.full_name} ${p.email} ${p.company} ${p.job}`.toLowerCase().includes(q.toLowerCase()))

  const clear = () => { setCompany(ALL); setCountry(ALL); setGroup(ALL); setQ('') }
  const filtered = company || country || group || q

  const Select = ({ label, value, onChange, options }) => (
    <div className="field" style={{ margin: 0, minWidth: 200 }}>
      <label style={{ marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={ALL}>All</option>
        {options.map(([name, count]) => (
          <option key={name} value={name}>{name} ({count})</option>
        ))}
      </select>
    </div>
  )

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
          <button className="btn" onClick={createTest} title="Crea 1 QR vCard + 1 wallet pass reales de prueba">
            Create test card
          </button>
        </div>
      </div>

      {test && (
        <div className="card" style={{ marginBottom: 14 }}>
          <b>Test card result (QR vCard + wallet pass):</b>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, maxHeight: 320, overflow: 'auto', marginBottom: 0 }}>
            {test.loading ? 'Creating…' : JSON.stringify(test, null, 2)}
          </pre>
        </div>
      )}
      <p className="muted" style={{ marginTop: -10 }}>
        Contacts extracted from the vCard QR codes. {msg && <b>{msg}</b>}
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap' }}>
        <Select label="Company" value={company} onChange={setCompany} options={companies} />
        <Select label="Country" value={country} onChange={setCountry} options={countries} />
        <Select label="Group (folder)" value={group} onChange={setGroup} options={groups} />
        <div className="field" style={{ margin: 0, minWidth: 200 }}>
          <label style={{ marginBottom: 4 }}>Search</label>
          <input placeholder="name, email, job…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {filtered ? <button className="btn secondary" onClick={clear} style={{ height: 40 }}>Clear</button> : null}
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {people && people.length === 0 && !error && (
        <div className="empty">No contacts yet. Click <b>Sync from QR</b> to extract them from your vCard QR codes.</div>
      )}

      {people && people.length > 0 && (
        <p className="muted" style={{ marginTop: 0 }}>Showing <b>{list.length}</b> of {people.length}</p>
      )}

      {list.length > 0 && (
        <table>
          <thead>
            <tr><th>Name</th><th>Company</th><th>Job</th><th>Email</th><th>Phone</th><th>Country</th><th>Group</th><th>Scans</th></tr>
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
                <td className="muted">{p.folder_name || p.folder_id || '—'}</td>
                <td><b>{p.total_scans ?? 0}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
