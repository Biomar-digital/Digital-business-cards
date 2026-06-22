import { NavLink, Route, Routes } from 'react-router-dom'
import CardDetail from './pages/CardDetail.jsx'
import Cards from './pages/Cards.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Groups from './pages/Groups.jsx'
import NewCard from './pages/NewCard.jsx'

export default function App() {
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
