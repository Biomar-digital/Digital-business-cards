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
        <h1>Cards</h1>
        <Link className="btn" to="/new">New card</Link>
      </div>

      <div className="field" style={{ maxWidth: 260 }}>
        <label>Filter by group</label>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); load(e.target.value) }}>
          <option value="">All</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {cards.length === 0 ? (
        <div className="empty">No cards.</div>
      ) : (
        <table>
          <thead><tr><th>Name</th><th>Job title</th><th>Email</th><th>Status</th><th>Pass</th></tr></thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <td><Link to={`/cards/${c.id}`}>{c.full_name}</Link></td>
                <td className="muted">{c.job_title || '—'}</td>
                <td className="muted">{c.email || '—'}</td>
                <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                <td>{c.pass_url ? <a href={c.pass_url} target="_blank" rel="noreferrer">Open</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
