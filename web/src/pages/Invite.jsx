import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { unifiedGroup, isPlaceholder } from '../lib/groups.js'

const EMAIL_RE = /[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+/

// Parsea el textarea: una persona por línea. Acepta:
//   correo@x.com
//   Nombre Apellido <correo@x.com>
//   Nombre Apellido, correo@x.com   (o al revés)
function parseRecipients(text) {
  const out = []
  const seen = new Set()
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(EMAIL_RE)
    if (!m) continue
    const email = m[0].toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)
    // Lo que queda al quitar el email (y los <>, comas) es el nombre.
    const name = line.replace(m[0], '').replace(/[<>,;]/g, '').trim()
    out.push({ email, name: name || undefined })
  }
  return out
}

export default function Invite() {
  const [text, setText] = useState('')
  const [company, setCompany] = useState('')
  const [groups, setGroups] = useState([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listPeople()
      .then((people) => {
        const set = new Set()
        for (const p of people || []) {
          if (isPlaceholder(p)) continue
          const g = unifiedGroup(p)
          if (g && g !== '—') set.add(g)
        }
        setGroups([...set].sort())
      })
      .catch(() => {})
  }, [])

  const recipients = useMemo(() => parseRecipients(text), [text])

  async function send() {
    setSending(true); setError(''); setResult(null)
    try {
      const r = await api.sendInvites(recipients, company || undefined)
      setResult(r)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setSending(false)
    }
  }

  const publicLink = `${window.location.origin}/request${company ? `?company=${encodeURIComponent(company)}` : ''}`

  return (
    <>
      <div className="page-head"><h1>Invite people</h1></div>
      <p className="muted" style={{ marginTop: -10, maxWidth: 680 }}>
        Send an email inviting someone to get their card. They fill in their details on a short form,
        and the request lands here in <b>Notifications</b> as <b>pending to create</b> — with all the info
        you need to generate their QR and Wallet card.
      </p>

      <div className="card" style={{ maxWidth: 680 }}>
        <div className="field">
          <label>Company / unit (optional)</label>
          <select value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">— Let them choose —</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <small className="muted">If set, the form comes pre-selected with this company.</small>
        </div>

        <div className="field">
          <label>Recipients — one per line</label>
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'anna.smith@biomar.com\nJon Berg <jon.berg@biomar.com>\nMaria Ruiz, maria.ruiz@biomar.com'}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          <small className="muted">
            Accepts a plain email, or <code>Name &lt;email&gt;</code>, or <code>Name, email</code>.
          </small>
        </div>

        {error && <p style={{ color: 'var(--red)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" disabled={sending || recipients.length === 0} onClick={send}>
            {sending ? 'Sending…' : `Send invitation${recipients.length === 1 ? '' : 's'} (${recipients.length})`}
          </button>
          {recipients.length > 0 && !sending && (
            <span className="muted" style={{ fontSize: 13 }}>{recipients.length} valid recipient{recipients.length === 1 ? '' : 's'} detected</span>
          )}
        </div>

        {result && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: '#eaf6ee', border: '1px solid #b7e0c4', borderRadius: 10 }}>
            <b>Sent {result.sent} of {result.total}.</b>
            {result.errors?.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--red)', fontSize: 13 }}>
                {result.errors.map((e, i) => <li key={i}>{e.email || '(no email)'}: {e.error}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: 680, marginTop: 14 }}>
        <b style={{ fontSize: 14 }}>Or share the link directly</b>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
          Anyone with this link can request a card (e.g. put it in an intranet post or Teams channel).
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input readOnly value={publicLink} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 260, fontFamily: 'monospace', fontSize: 13 }} />
          <button className="btn secondary" onClick={() => navigator.clipboard?.writeText(publicLink)}>Copy link</button>
        </div>
      </div>
    </>
  )
}
