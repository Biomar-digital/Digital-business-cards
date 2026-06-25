import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { isPlaceholder, unifiedGroup } from '../lib/groups.js'

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0 }

export default function Analytics() {
  const [raw, setRaw] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.listPeople().then(setRaw).catch((e) => setError(String(e.message || e))) }, [])

  const people = useMemo(
    () => (raw || []).filter((p) => !isPlaceholder(p)).map((p) => ({ ...p, _group: unifiedGroup(p) })),
    [raw],
  )

  const total = people.length
  const withPass = people.filter((p) => p.pass_url).length
  const emailed = people.filter((p) => p.intro_email_at).length
  const scans = people.reduce((s, p) => s + (Number(p.total_scans) || 0), 0)
  const scanned = people.filter((p) => (Number(p.total_scans) || 0) > 0).length

  const byGroup = useMemo(() => {
    const m = new Map()
    for (const p of people) {
      const g = p._group
      const e = m.get(g) || { group: g, people: 0, pass: 0, emailed: 0, scans: 0 }
      e.people++
      if (p.pass_url) e.pass++
      if (p.intro_email_at) e.emailed++
      e.scans += Number(p.total_scans) || 0
      m.set(g, e)
    }
    return [...m.values()].sort((a, b) => b.people - a.people)
  }, [people])

  const topScanned = useMemo(
    () => [...people].filter((p) => Number(p.total_scans) > 0)
      .sort((a, b) => (Number(b.total_scans) || 0) - (Number(a.total_scans) || 0)).slice(0, 10),
    [people],
  )

  return (
    <>
      <div className="page-head"><h1>Analytics</h1></div>
      <p className="muted" style={{ marginTop: -10 }}>Adoption of the digital business cards across BioMar.</p>

      {error && <div className="card" style={{ borderColor: 'var(--red)' }}>⚠️ {error}</div>}
      {!raw && !error && <div className="empty">Loading…</div>}

      {raw && (
        <>
          <div className="cards-grid">
            <div className="stat"><div className="num">{total}</div><div className="label">People</div></div>
            <div className="stat"><div className="num">{withPass}</div><div className="label">With pass · {pct(withPass, total)}%</div></div>
            <div className="stat"><div className="num">{emailed}</div><div className="label">Emailed · {pct(emailed, total)}%</div></div>
            <div className="stat"><div className="num">{scans}</div><div className="label">Total QR scans</div></div>
          </div>

          <div className="cards-grid" style={{ marginTop: 14 }}>
            <div className="stat"><div className="num">{scanned}</div><div className="label">People scanned ≥1 · {pct(scanned, total)}%</div></div>
            <div className="stat"><div className="num">{withPass ? Math.round(scans / withPass) : 0}</div><div className="label">Avg scans / card</div></div>
            <div className="stat"><div className="num">{total - withPass}</div><div className="label">Still without pass</div></div>
          </div>

          <h2 style={{ marginTop: 32, fontSize: 16 }}>Adoption by group</h2>
          <table>
            <thead>
              <tr><th>Group</th><th>People</th><th>With pass</th><th>Coverage</th><th>Emailed</th><th>Scans</th></tr>
            </thead>
            <tbody>
              {byGroup.map((g) => (
                <tr key={g.group}>
                  <td><b>{g.group}</b></td>
                  <td>{g.people}</td>
                  <td>{g.pass}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 120, height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${pct(g.pass, g.people)}%`, height: '100%', background: 'var(--blue, #1f3e77)' }} />
                      </div>
                      <span className="muted" style={{ fontSize: 12 }}>{pct(g.pass, g.people)}%</span>
                    </div>
                  </td>
                  <td className="muted">{g.emailed}</td>
                  <td className="muted">{g.scans}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 32, fontSize: 16 }}>Most scanned cards</h2>
          {topScanned.length === 0 ? (
            <div className="empty">No scans recorded yet.</div>
          ) : (
            <table>
              <thead><tr><th>Name</th><th>Group</th><th>Scans</th></tr></thead>
              <tbody>
                {topScanned.map((p) => (
                  <tr key={p.qr_id}>
                    <td>{p.full_name || '—'}</td>
                    <td className="muted">{p._group}</td>
                    <td>{p.total_scans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="muted" style={{ marginTop: 18, fontSize: 12 }}>
            Scan counts come from the qrco.de vCard QR codes. Run <Link to="/people">People → Sync</Link> to refresh.
          </p>
        </>
      )}
    </>
  )
}
