import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const load = () => api.listGroups().then(setGroups).catch(() => {})
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return
    await api.createGroup({ name, description })
    setName(''); setDescription('')
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this group? Its cards will be left without a group.')) return
    await api.deleteGroup(id)
    load()
  }

  return (
    <>
      <div className="page-head"><h1>Groups</h1></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          {groups.length === 0 ? <div className="empty">No groups.</div> : (
            <table>
              <thead><tr><th>Name</th><th>Cards</th><th></th></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}<div className="muted" style={{ fontSize: 12 }}>{g.description}</div></td>
                    <td>{g.card_count}</td>
                    <td><button className="btn danger" onClick={() => remove(g.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <form className="card" onSubmit={create}>
          <h2 style={{ fontSize: 15, marginTop: 0 }}>New group</h2>
          <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Description</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <button className="btn">Create group</button>
        </form>
      </div>
    </>
  )
}
