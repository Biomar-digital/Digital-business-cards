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
    if (!confirm('¿Eliminar el grupo? Las tarjetas quedarán sin grupo.')) return
    await api.deleteGroup(id)
    load()
  }

  return (
    <>
      <div className="page-head"><h1>Grupos</h1></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          {groups.length === 0 ? <div className="empty">No hay grupos.</div> : (
            <table>
              <thead><tr><th>Nombre</th><th>Tarjetas</th><th></th></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}<div className="muted" style={{ fontSize: 12 }}>{g.description}</div></td>
                    <td>{g.card_count}</td>
                    <td><button className="btn danger" onClick={() => remove(g.id)}>Eliminar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <form className="card" onSubmit={create}>
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Nuevo grupo</h2>
          <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Descripción</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <button className="btn">Crear grupo</button>
        </form>
      </div>
    </>
  )
}
