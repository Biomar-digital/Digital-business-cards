import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { isPlaceholder, unifiedGroup } from '../lib/groups.js'

const ALL = ''

export default function Passes() {
  const [raw, setRaw] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState(ALL)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [example, setExample] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = () => api.listPeople().then(setRaw).catch((e) => setError(String(e.message || e)))
  useEffect(() => { load() }, [])

  // Solo personas reales que YA tienen un wallet pass.
  const passes = useMemo(
    () => (raw || [])
      .filter((p) => !isPlaceholder(p) && p.pass_url)
      .map((p) => ({ ...p, _group: unifiedGroup(p) })),
    [raw],
  )

  const groups = useMemo(() => {
    const m = new Map()
    for (const p of passes) m.set(p._group, (m.get(p._group) || 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [passes])

  const list = passes
    .filter((p) => group === ALL || p._group === group)
    .filter((p) => !q || `${p.full_name} ${p.email} ${p.company} ${p.job}`.toLowerCase().includes(q.toLowerCase()))

  const sendable = list.filter((p) => selected.has(String(p.qr_id)) && p.email)
  const allSel = list.length > 0 && list.every((p) => selected.has(String(p.qr_id)))
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSel) list.forEach((p) => n.delete(String(p.qr_id)))
    else list.forEach((p) => n.add(String(p.qr_id)))
    return n
  })

  async function sendEmails() {
    const ids = passes
      .filter((p) => selected.has(String(p.qr_id)) && p.email)
      .map((p) => String(p.qr_id))
    if (!ids.length) { setMsg('No selected passes have an email.'); return }
    if (!window.confirm(`Send the intro email to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}? This sends real emails.`)) return
    setBusy(true); setMsg('Sending intro emails…')
    try {
      let sent = 0
      const errs = []
      for (let i = 0; i < ids.length; i += 20) {
        const r = await api.sendIntroEmails(ids.slice(i, i + 20))
        sent += r.sent
        if (r.errors?.length) errs.push(...r.errors)
        setMsg(`Sent ${sent}/${ids.length}…`)
      }
      await load()
      setMsg(`Done. ${sent} intro emails sent${errs.length ? `, ${errs.length} failed: ${errs[0].error}` : ''}.`)
      setSelected(new Set())
    } catch (e) { setMsg('Error: ' + (e.message || e)) } finally { setBusy(false) }
  }

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

  return (
    <>
      <div className="page-head">
        <h1>Wallet passes ({passes.length})</h1>
        <button className="btn secondary" onClick={makeExample} disabled={creating}>
          {creating ? 'Creating…' : 'Create example pass'}
        </button>
      </div>
      <p className="muted" style={{ marginTop: -10 }}>
        People who already have a wallet pass. Send or re-send the intro email here. {msg && <b>{msg}</b>}
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
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', margin: '14px 0 12px', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label style={{ marginBottom: 4 }}>Group (unified)</label>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value={ALL}>All groups</option>
            {groups.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 200 }}>
          <label style={{ marginBottom: 4 }}>Search</label>
          <input placeholder="name, email, job…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {raw && passes.length === 0 && !error && (
        <div className="empty">No wallet passes yet. Create them from the <b>People</b> tab.</div>
      )}

      {passes.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="muted">Showing <b>{list.length}</b> · <b>{selected.size}</b> selected · {sendable.length} with email</span>
          <button className="btn" disabled={busy || sendable.length === 0} onClick={sendEmails}>
            Send intro email ({sendable.length})
          </button>
        </div>
      )}

      {list.length > 0 && (
        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}><input type="checkbox" checked={allSel} onChange={toggleAll} /></th>
              <th>Name</th><th>Group</th><th>Job</th><th>Email</th><th>Pass</th><th>Emailed</th>
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
                <td>{p.pass_url ? <a href={p.pass_url} target="_blank" rel="noreferrer">✓ pass</a> : <span className="muted">—</span>}</td>
                <td className="muted" title={p.intro_email_at || ''}>{p.intro_email_at ? '✉ sent' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
