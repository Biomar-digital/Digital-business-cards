import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { api, getToken, setToken } from './api.js'
import Analytics from './pages/Analytics.jsx'
import CardDetail from './pages/CardDetail.jsx'
import Cards from './pages/Cards.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Groups from './pages/Groups.jsx'
import NewCard from './pages/NewCard.jsx'
import PassImages from './pages/PassImages.jsx'
import Passes from './pages/Passes.jsx'
import People from './pages/People.jsx'
import Requests from './pages/Requests.jsx'
import QrCodes from './pages/QrCodes.jsx'
import Templates from './pages/Templates.jsx'

function Logo() {
  const [ok, setOk] = useState(true)
  return (
    <span className="brand-chip">
      {ok ? (
        <img
          className="brand-logo"
          src="/biomar-logo.png"
          alt="BioMar"
          onError={() => setOk(false)}
        />
      ) : (
        <span className="brand-word">BioMar</span>
      )}
    </span>
  )
}

function Login({ onAuthed }) {
  const [token, setT] = useState(getToken())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setToken(token.trim())
    try {
      await api.health()
      onAuthed()
    } catch {
      setError('Invalid token')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="login-card card" onSubmit={submit}>
        <Logo />
        <p className="muted" style={{ margin: '12px 0 18px' }}>Digital Business Cards · Admin</p>
        <div className="field">
          <label>Admin token</label>
          <input
            type="password"
            placeholder="x-admin-token"
            value={token}
            onChange={(e) => setT(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p style={{ color: 'var(--red)' }}>{error}</p>}
        <button className="btn" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(null) // null = checking
  const [openReqs, setOpenReqs] = useState(0)

  useEffect(() => {
    api
      .health()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
  }, [])

  // Contador de notificaciones (solicitudes abiertas), con sondeo periódico.
  useEffect(() => {
    if (!authed) return
    let alive = true
    const tick = () => api.listRequests()
      .then((rs) => { if (alive) setOpenReqs((rs || []).filter((r) => r.status !== 'done').length) })
      .catch(() => {})
    tick()
    const t = setInterval(tick, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [authed])

  if (authed === null) {
    return (
      <div className="login">
        <p style={{ color: '#cbd5e0' }}>Loading…</p>
      </div>
    )
  }

  if (!authed) return <Login onAuthed={() => setAuthed(true)} />

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <small className="brand-sub">Digital Business Cards · Admin</small>
        </div>
        <nav className="nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/analytics">Analytics</NavLink>
          <NavLink to="/cards">Cards</NavLink>
          <NavLink to="/passes">Wallet passes</NavLink>
          <NavLink to="/pass-images">Pass images</NavLink>
          <NavLink to="/qr">QR codes</NavLink>
          <NavLink to="/people">People</NavLink>
          <NavLink to="/templates">Templates</NavLink>
          <NavLink to="/requests" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Notifications</span>
            {openReqs > 0 && (
              <span style={{ background: '#e53e3e', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 8px', marginLeft: 8 }}>
                {openReqs}
              </span>
            )}
          </NavLink>
          <NavLink to="/groups">Groups</NavLink>
          <NavLink to="/new">New card</NavLink>
        </nav>
        <button
          className="btn secondary logout"
          onClick={() => {
            setToken('')
            setAuthed(false)
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/cards/:id" element={<CardDetail />} />
          <Route path="/passes" element={<Passes />} />
          <Route path="/pass-images" element={<PassImages />} />
          <Route path="/qr" element={<QrCodes />} />
          <Route path="/people" element={<People />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/new" element={<NewCard />} />
        </Routes>
      </main>
    </div>
  )
}
