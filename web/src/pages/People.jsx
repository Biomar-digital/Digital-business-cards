import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const ALL = ''

// Normaliza un nombre (empresa o carpeta) al grupo canónico de BioMar.
function canonicalGroup(name) {
  if (!name) return '—'
  const s = String(name).toLowerCase()
  const has = (...ks) => ks.some((k) => s.includes(k))
  if (has('aq1')) return 'AQ1 Systems'
  if (has('sagun')) return 'BioMar Sagun (Turkey)'
  if (has('norge', 'norway', 'karm')) return 'BioMar Norway'
  if (has('iberia', 'spain', 'españa', 'espana')) return 'BioMar Spain'
  if (has('ooo') || /\bru\b/.test(s) || has('russia')) return 'BioMar Russia'
  if (has('australia')) return 'BioMar Australia'
  if (has('chile')) return 'BioMar Chile'
  if (has('costa rica')) return 'BioMar Costa Rica'
  if (has('ecuador')) return 'BioMar Ecuador'
  if (/\buk\b/.test(s) || has('united kingdom')) return 'BioMar UK'
  if (has('france', 'emea')) return 'BioMar France'
  if (has('r&d')) return 'BioMar R&D'
  if (has('sourcing')) return 'BioMar Sourcing'
  if (has('sustainab')) return 'BioMar Sustainability'
  if (has('iberia')) return 'BioMar Spain'
  if (has('biomar')) return 'BioMar Group'
  return name
}

// Grupo final: la carpeta si es significativa, si no la empresa; todo normalizado.
function unifiedGroup(p) {
  const folder = String(p.folder_name || '').trim()
  const base = folder && folder !== '1' && !/templates/i.test(folder) ? folder : p.company || ''
  return canonicalGroup(base)
}

// Filas de plantilla (nombre "* *" / email "*") que no son personas reales.
function isPlaceholder(p) {
  const n = String(p.full_name || '').replace(/\s/g, '')
  return !n || /^\*+$/.test(n) || p.email === '*'
}

export default function People() {
  const [raw, setRaw] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState(ALL)
  const [country, setCountry] = useState(ALL)
  const [onlyNoPass, setOnlyNoPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [sendEmail, setSendEmail] = useState(false)

  const load = () => api.listPeople().then(setRaw).catch((e) => setError(String(e.message || e)))
  useEffect(() => { load() }, [])

  // Personas reales, con su grupo unificado.
  const people = useMemo(
    () => (raw || []).filter((p) => !isPlaceholder(p)).map((p) => ({ ...p, _group: unifiedGroup(p) })),
    [raw],
  )

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

  async function createPasses() {
    const ids = [...selected]
    if (!ids.length) return
    setBusy(true); setMsg('Creating wallet passes…')
    try {
      let created = 0, emailed = 0
      for (let i = 0; i < 100; i++) {
        const r = await api.createPasses(ids, sendEmail)
        created += r.created; emailed += r.emailed || 0
        setMsg(`Created ${created} passes${sendEmail ? `, ${emailed} emails` : ''}… ${r.remaining} remaining`)
        await load()
        if (r.remaining === 0 || r.created === 0) {
          if (r.errors?.length) setMsg(`Created ${created}. Some failed: ${r.errors[0].error}`)
          break
        }
      }
      setMsg(`Done. ${created} passes created${sendEmail ? `, ${emailed} intro emails sent` : ''}.`)
      setSelected(new Set())
    } catch (e) { setMsg('Error: ' + (e.message || e)) } finally { setBusy(false) }
  }

  const facet = (field) => {
    const m = new Map()
    for (const p of people) {
      if (field !== 'group' && group && p._group !== group) continue
      if (field !== 'country' && country && (p.country || '—') !== country) continue
      const key = field === 'group' ? p._group : (p.country || '—')
      m.set(key, (m.get(key) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const groups = useMemo(() => facet('group'), [people, country])
  const countries = useMemo(() => facet('country'), [people, group])

  const list = people
    .filter((p) => group === ALL || p._group === group)
    .filter((p) => country === ALL || (p.country || '—') === country)
    .filter((p) => !onlyNoPass || !p.pass_url)
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

  return (
    <>
      <div className="page-head">
        <h1>People ({people.length})</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" disabled={busy} onClick={() => sync(false)}>{busy ? '…' : 'Sync from QR'}</button>
          <button className="btn secondary" disabled={busy} onClick={() => sync(true)} title="Re-fetch all">Resync all</button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -10 }}>Contacts grouped by unified company. {msg && <b>{msg}</b>}</p>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label style={{ marginBottom: 4 }}>Group (unified)</label>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value={ALL}>All groups</option>
            {groups.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 180 }}>
          <label style={{ marginBottom: 4 }}>Country</label>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value={ALL}>All</option>
            {countries.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 170 }}>
          <label style={{ marginBottom: 4 }}>Search</label>
          <input placeholder="name, email, job…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="checkbox" style={{ marginBottom: 10 }}>
          <input type="checkbox" checked={onlyNoPass} onChange={(e) => setOnlyNoPass(e.target.checked)} /> Only without pass
        </label>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {raw && people.length === 0 && !error && (
        <div className="empty">No contacts yet. Click <b>Sync from QR</b>.</div>
      )}

      {people.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="muted">Showing <b>{list.length}</b> · {withPass} with pass · <b>{selected.size}</b> selected</span>
          <label className="checkbox">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Send intro email
          </label>
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
              <th>Name</th><th>Group</th><th>Job</th><th>Email</th><th>Country</th><th>Pass</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.qr_id}>
                <td><input type="checkbox" checked={selected.has(String(p.qr_id))} onChange={() => toggle(String(p.qr_id))} /></td>
                <td>{p.full_name || '—'}</td>
                <td>{p._group}</td>
                <td className="muted">{p.job || '—'}</td>
                <td className="muted">{p.email || '—'}</td>
                <td className="muted">{p.country || '—'}</td>
                <td>{p.pass_url ? <a href={p.pass_url} target="_blank" rel="noreferrer">✓ pass</a> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
