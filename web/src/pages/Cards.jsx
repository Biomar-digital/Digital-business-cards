import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function Cards() {
  const [cards, setCards] = useState([])
  const [groups, setGroups] = useState([])
  const [filter, setFilter] = useState('')

  const load = (groupId) => api.listCards(groupId).then(setCards).catch(() => {})

  useEffect(() => {
    load('')
    api.listGroups().then(setGroups).catch(() => {})
  }, [])

  return (
    <>
      <div className="page-head">
        <h1>Tarjetas</h1>
        <Link className="btn" to="/new">➕ Nueva</Link>
      </div>

      <div className="field" style={{ maxWidth: 260 }}>
        <label>Filtrar por grupo</label>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); load(e.target.value) }}>
          <option value="">Todos</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {cards.length === 0 ? (
        <div className="empty">No hay tarjetas.</div>
      ) : (
        <table>
          <thead><tr><th>Nombre</th><th>Cargo</th><th>Email</th><th>Estado</th><th>Pase</th></tr></thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <td><Link to={`/cards/${c.id}`}>{c.full_name}</Link></td>
                <td className="muted">{c.job_title || '—'}</td>
                <td className="muted">{c.email || '—'}</td>
                <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                <td>{c.pass_url ? <a href={c.pass_url} target="_blank" rel="noreferrer">Abrir</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
