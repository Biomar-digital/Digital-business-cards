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
  const [selected, setSelected] = useState(() => new Set())

  const load = () => api.listPeople().then(setPeople).catch((e) => setError(String(e.message || e)))
  useEffect(() => { load() }, [])

  async function sync(reset) {
    setBusy(true); setMsg('Indexing…')
    try {
      if (reset) await api.resetPeople()
      const idx = await api.indexPeople()
      let remaining = idx.pending, done = 0
      for (let i = 0; i < 60; i++) {
        const r = await api.syncPeople()
        done += r.synced; remaining = r.remaining
        setMsg(`Synced ${done}… ${remaining} remaining`); await load()
        if (remaining === 0 || r.synced === 0) break
      }
      setMsg(`Done. ${done} synced, ${remaining} remaining.`)
    } catch (e) { setMsg('Error: ' + (e.message || e)) } finally { setBusy(false) }
  }

  // Crea wallet passes para los seleccionados (en lotes hasta terminar).
  async function createPasses() {
    const ids = [...selected]
    if (!ids.length) return
    setBusy(true); setMsg('Creating wallet passes…')
    try {
      let created = 0
      for (let i = 0; i < 100; i++) {
        const r = await api.createPasses(ids)
        created += r.created
        setMsg(`Created ${created} passes… ${r.remaining} remaining`)
        await load()
        if (r.remaining === 0 || r.created === 0) {
          if (r.errors?.length) setMsg(`Created ${created}. Some failed: ${r.errors[0].error}`)
          break
        }
      }
      setMsg(`Done. ${created} wallet passes created.`)
      setSelected(new Set())
    } catch (e) { setMsg('Error: ' + (e.message || e)) } finally { setBusy(false) }
  }

  const facet = (field) => {
    const m = new Map()
    for (const p of people || []) {
      if (field !== 'company' && company && (p.company || '—') !== company) continue
      if (field !== 'country' && country && (p.country || '—') !== country) continue
      if (field !== 'group' && group && (p.folder_name || p.folder_id || '—') !== group) continue
      const key = field === 'company' ? (p.company || '—') : field === 'country' ? (p.country || '—') : (p.folder_name || p.folder_id || '—')
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

  const withPass = list.filter((p) => p.pass_url).length
  const allSel = list.length > 0 && list.every((p) => selected.has(String(p.qr_id)))
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSel) list.forEach((p) => n.delete(String(p.qr_id)))
    else list.forEach((p) => n.add(String(p.qr_id)))
    return n
  })

  const clear = () => { setCompany(ALL); setCountry(ALL); setGroup(ALL); setQ('') }
  const Select = ({ label, value, onChange, options }) => (
    <div className="field" style={{ margin: 0, minWidth: 190 }}>
      <label style={{ marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={ALL}>All</option>
        {options.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
      </select>
    </div>
  )

  return (
    <>
      <div className="page-head">
        <h1>People ({people ? people.length : '…'})</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" disabled={busy} onClick={() => sync(false)}>{busy ? '…' : 'Sync from QR'}</button>
          <button className="btn secondary" disabled={busy} onClick={() => sync(true)} title="Re-fetch all">Resync all</button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -10 }}>
        Contacts from the vCard QR codes. {msg && <b>{msg}</b>}
      </p>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <Select label="Company" value={company} onChange={setCompany} options={companies} />
        <Select label="Country" value={country} onChange={setCountry} options={countries} />
        <Select label="Group (folder)" value={group} onChange={setGroup} options={groups} />
        <div className="field" style={{ margin: 0, minWidth: 180 }}>
          <label style={{ marginBottom: 4 }}>Search</label>
          <input placeholder="name, email, job…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {(company || country || group || q) ? <button className="btn secondary" onClick={clear} style={{ height: 40 }}>Clear</button> : null}
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {people && people.length === 0 && !error && (
        <div className="empty">No contacts yet. Click <b>Sync from QR</b> to extract them.</div>
      )}

      {people && people.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="muted">Showing <b>{list.length}</b> · {withPass} with pass · <b>{selected.size}</b> selected</span>
          <button className="btn" disabled={busy || selected.size === 0} onClick={createPasses}>
            Create wallet passes ({selected.size})
          </button>
        </div>
      )}

      {list.length > 0 && (
        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}><input type="checkbox" checked={allSel} onChange={toggleAll} /></th>
              <th>Name</th><th>Company</th><th>Job</th><th>Email</th><th>Country</th><th>Group</th><th>Pass</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.qr_id}>
                <td><input type="checkbox" checked={selected.has(String(p.qr_id))} onChange={() => toggle(String(p.qr_id))} /></td>
                <td>{p.full_name || '—'}</td>
                <td>{p.company || '—'}</td>
                <td className="muted">{p.job || '—'}</td>
                <td className="muted">{p.email || '—'}</td>
                <td className="muted">{p.country || '—'}</td>
                <td className="muted">{p.folder_name || p.folder_id || '—'}</td>
                <td>{p.pass_url ? <a href={p.pass_url} target="_blank" rel="noreferrer">✓ pass</a> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
