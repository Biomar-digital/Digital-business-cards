import { useEffect, useState } from 'react'
import { api } from '../api.js'

// Aplica una imagen a un scope: la guarda y re-pushea los pases existentes
// en lotes. Devuelve un texto de progreso vía onProgress.
async function applyScope({ scope, group, image }, onProgress) {
  const res = await api.setHero({ scope, group, image })
  const ids = res.affected || []
  let updated = 0
  const errs = []
  for (let i = 0; i < ids.length; i += 20) {
    const r = await api.repushHero(ids.slice(i, i + 20))
    updated += r.updated
    if (r.errors?.length) errs.push(...r.errors)
    onProgress(`Updating existing passes… ${updated}/${ids.length}`)
  }
  return { affected: ids.length, updated, errs }
}

function Thumb({ url }) {
  if (!url) return <span className="muted" style={{ fontSize: 12 }}>No image (uses default/template)</span>
  return <img src={url} alt="" style={{ height: 40, borderRadius: 6, border: '1px solid var(--line,#dce6f0)' }} onError={(e) => { e.target.style.display = 'none' }} />
}

function ScopeRow({ label, sub, value, busy, onApply }) {
  const [img, setImg] = useState(value || '')
  useEffect(() => { setImg(value || '') }, [value])
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <b>{label}</b>
          {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
        </div>
        <Thumb url={value} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <input
          placeholder="https://…/image.jpg  (leave empty to reset)"
          value={img}
          onChange={(e) => setImg(e.target.value)}
          style={{ flex: 1, minWidth: 240 }}
        />
        <button className="btn" disabled={busy} onClick={() => onApply(img.trim())}>Save &amp; apply</button>
      </div>
    </div>
  )
}

export default function PassImages() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => api.getHero().then(setData).catch((e) => setError(String(e.message || e)))
  useEffect(() => { load() }, [])

  async function apply(scope, group, image) {
    setBusy(true); setMsg('Saving…')
    try {
      const r = await applyScope({ scope, group, image }, setMsg)
      setMsg(`Done. ${r.affected} existing passes affected, ${r.updated} updated${r.errs.length ? `, ${r.errs.length} failed (the pass update endpoint may need confirming).` : '.'}`)
      await load()
    } catch (e) { setMsg('Error: ' + (e.message || e)) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="page-head"><h1>Pass images (campaigns)</h1></div>
      <p className="muted" style={{ marginTop: -10 }}>
        Set the wallet pass background image by <b>everyone</b>, by <b>group</b>, or per person (in People → Edit).
        Priority: person → group → default. {msg && <b>{msg}</b>}
      </p>
      <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
        The image must be a public URL. New passes use it automatically; existing passes are re-pushed when you apply.
      </p>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {!data && !error && <div className="empty">Loading…</div>}

      {data && (
        <>
          <h2 style={{ fontSize: 15, marginTop: 18 }}>Default — everyone</h2>
          <ScopeRow
            label="Default image"
            sub="Used when a person or their group has no specific image."
            value={data.default}
            busy={busy}
            onApply={(img) => apply('all', null, img)}
          />

          <h2 style={{ fontSize: 15, marginTop: 22 }}>By group</h2>
          {data.groups.length === 0 && <div className="empty">No groups yet. Sync people first.</div>}
          {data.groups.map((g) => (
            <ScopeRow
              key={g.group}
              label={g.group}
              value={g.image}
              busy={busy}
              onApply={(img) => apply('group', g.group, img)}
            />
          ))}
        </>
      )}
    </>
  )
}
