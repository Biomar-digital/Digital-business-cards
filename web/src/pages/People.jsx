import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { isPlaceholder, unifiedGroup } from '../lib/groups.js'

const ALL = ''

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
  const [editing, setEditing] = useState(null)
  const openEdit = (p) => setEditing(p)

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

  async function createPasses(withEmail) {
    const ids = [...selected]
    if (!ids.length) return
    setBusy(true); setMsg(withEmail ? 'Creating passes + sending emails…' : 'Creating wallet passes…')
    try {
      let created = 0, emailed = 0
      for (let i = 0; i < 100; i++) {
        const r = await api.createPasses(ids, withEmail)
        created += r.created; emailed += r.emailed || 0
        setMsg(`Created ${created} passes${withEmail ? `, ${emailed} emails` : ''}… ${r.remaining} remaining`)
        await load()
        if (r.remaining === 0 || r.created === 0) {
          if (r.errors?.length) setMsg(`Created ${created}. Some failed: ${r.errors[0].error}`)
          break
        }
      }
      setMsg(`Done. ${created} passes created${withEmail ? `, ${emailed} intro emails sent` : ''}.`)
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
  const noPassSel = people.filter((p) => selected.has(String(p.qr_id)) && !p.pass_url).length
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
          <button
            className="btn"
            disabled={busy || noPassSel === 0}
            onClick={() => createPasses(false)}
            title="Create the wallet pass for selected people (no email)"
          >
            Create pass ({noPassSel})
          </button>
          <button
            className="btn"
            disabled={busy || noPassSel === 0}
            onClick={() => createPasses(true)}
            title="Create the wallet pass and send the intro email right away"
          >
            Create pass + send email ({noPassSel})
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            To send emails to people who already have a pass, use the <b>Wallet passes</b> tab.
          </span>
        </div>
      )}

      {list.length > 0 && (
        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}><input type="checkbox" checked={allSel} onChange={toggleAll} /></th>
              <th>Name</th><th>Group</th><th>Job</th><th>Email</th><th>Country</th><th>Pass</th><th></th>
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
                <td><button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <EditModal
          person={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load() }}
        />
      )}
    </>
  )
}

const FIELDS = [
  ['full_name', 'Full name'], ['company', 'Company'], ['job', 'Job title'],
  ['email', 'Email'], ['mobile', 'Mobile'], ['phone', 'Phone'], ['country', 'Country'],
  ['hero_image', 'Pass image URL (overrides group/default)'],
]

function EditModal({ person, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    const f = {}
    for (const [k] of FIELDS) f[k] = person[k] || ''
    return f
  })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))

  async function save() {
    setBusy(true); setResult(null)
    try {
      const r = await api.updatePerson(person.qr_id, form)
      setResult(r)
      // Si no tiene pase, o el push salió OK, cerramos tras un momento.
      if (r.ok && (r.pass?.skipped || r.pass?.ok)) {
        setTimeout(onSaved, 900)
      }
    } catch (e) {
      setResult({ ok: false, error: String(e.message || e) })
    } finally { setBusy(false) }
  }

  const passMsg = !result ? null
    : result.error ? `Error: ${result.error}`
    : result.pass?.skipped ? 'Saved. (No wallet pass to update.)'
    : result.pass?.ok ? 'Saved and pushed to the wallet pass ✓'
    : 'Saved in the directory, but the wallet pass update failed — the AddToWallet update endpoint may differ. See details below.'

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,55,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}
    >
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Edit {person.full_name || 'person'}</h2>
        <p className="muted" style={{ marginTop: -6, fontSize: 13 }}>
          {person.pass_url ? 'Changes are also pushed to the wallet pass.' : 'This person has no wallet pass yet — changes save to the directory.'}
        </p>
        {FIELDS.map(([k, label]) => (
          <div className="field" key={k} style={{ marginBottom: 8 }}>
            <label style={{ marginBottom: 4 }}>{label}</label>
            <input value={form[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
        {passMsg && (
          <div className="card" style={{ marginTop: 6, borderColor: result?.ok && (result.pass?.ok || result.pass?.skipped) ? undefined : 'var(--red)' }}>
            {passMsg}
            {result && !result.pass?.ok && !result.pass?.skipped && result.pass?.attempts && (
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, marginBottom: 0, marginTop: 8 }}>
                {JSON.stringify(result.pass.attempts, null, 2)}
              </pre>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose} disabled={busy}>Close</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
