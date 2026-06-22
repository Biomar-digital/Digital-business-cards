import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { api, getToken, setToken } from './api.js'
import CardDetail from './pages/CardDetail.jsx'
import Cards from './pages/Cards.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Groups from './pages/Groups.jsx'
import NewCard from './pages/NewCard.jsx'

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
      setError('Token incorrecto')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="login-card card" onSubmit={submit}>
        <h1 style={{ marginTop: 0 }}>Tarjetas Digitales</h1>
        <p className="muted">Introduce el token de administración para acceder.</p>
        <div className="field">
          <label>Token de administración</label>
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
          {busy ? 'Comprobando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(null) // null = comprobando

  useEffect(() => {
    api
      .health()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) {
    return (
      <div className="login">
        <p className="muted">Cargando…</p>
      </div>
    )
  }

  if (!authed) return <Login onAuthed={() => setAuthed(true)} />

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          Tarjetas Digitales
          <small>Biomar Digital · Admin</small>
        </div>
        <nav className="nav">
          <NavLink to="/" end>📊 Dashboard</NavLink>
          <NavLink to="/cards">💳 Tarjetas</NavLink>
          <NavLink to="/groups">👥 Grupos</NavLink>
          <NavLink to="/new">➕ Nueva tarjeta</NavLink>
        </nav>
        <button
          className="btn secondary logout"
          onClick={() => {
            setToken('')
            setAuthed(false)
          }}
        >
          Cerrar sesión
        </button>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/cards/:id" element={<CardDetail />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/new" element={<NewCard />} />
        </Routes>
      </main>
    </div>
  )
}
