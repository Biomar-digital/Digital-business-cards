import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function Dashboard() {
  const [data, setData] = useState({ people: [], passes: [], qr: [], requests: [] })
  const [mode, setMode] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      api.listPeople(),
      api.listPasses(),
      api.listQr(),
      api.listRequests(),
      api.health(),
    ]).then((res) => {
      if (!alive) return
      const val = (i, d) => (res[i].status === 'fulfilled' && res[i].value) || d
      setData({
        people: val(0, []),
        passes: val(1, []),
        qr: val(2, []),
        requests: val(3, []),
      })
      setMode(val(4, {}).mode || '')
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const { people, passes, qr, requests } = data
  const withPass = people.filter((p) => p.pass_id || p.pass_url).length
  const withoutPass = people.length - withPass
  const openRequests = requests.filter((r) => r.status !== 'done').length

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <Link className="btn" to="/people">Go to People</Link>
      </div>
      {mode === 'mock' && (
        <p className="muted" style={{ marginTop: -10 }}>
          <b>Mock mode</b>: passes and QR codes are simulated. Set the API keys and
          {' '}<code>PROVIDER_MODE=live</code> to use the real providers.
        </p>
      )}

      {loading ? (
        <div className="empty">Loading…</div>
      ) : (
        <>
          <div className="cards-grid">
            <Stat to="/people" num={people.length} label="People" />
            <Stat to="/qr" num={qr.length} label="QR codes" />
            <Stat to="/passes" num={passes.length} label="Wallet passes" />
            <Stat to="/people" num={withoutPass} label="Without pass" color={withoutPass ? 'var(--blue)' : undefined} />
          </div>

          <div className="cards-grid" style={{ marginTop: 14 }}>
            <Stat to="/people" num={withPass} label="People with a pass" />
            <Stat to="/requests" num={openRequests} label="Open change requests" color={openRequests ? 'var(--red)' : undefined} />
          </div>

          <h2 style={{ marginTop: 32, fontSize: 16 }}>Latest people</h2>
          {people.length === 0 ? (
            <div className="empty">No people indexed yet. Go to People and run Sync.</div>
          ) : (
            <table>
              <thead><tr><th>Name</th><th>Company</th><th>Pass</th><th>QR</th></tr></thead>
              <tbody>
                {people.slice(0, 8).map((p) => (
                  <tr key={p.qr_id || p.id}>
                    <td>{p.full_name || '—'}</td>
                    <td className="muted">{p.company || '—'}</td>
                    <td>
                      {p.pass_id || p.pass_url
                        ? <span className="badge active">yes</span>
                        : <span className="badge draft">no</span>}
                    </td>
                    <td className="muted">{p.short_url ? <a href={p.short_url} target="_blank" rel="noreferrer">{p.short_url}</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  )
}

function Stat({ to, num, label, color }) {
  const inner = (
    <div className="stat">
      <div className="num" style={color ? { color } : undefined}>{num}</div>
      <div className="label">{label}</div>
    </div>
  )
  return to ? <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link> : inner
}
