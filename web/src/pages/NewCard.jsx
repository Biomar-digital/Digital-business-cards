import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const empty = {
  fullName: '', jobTitle: '', company: '', email: '',
  phone: '', website: '', groupId: '', notes: '', sendEmail: false,
}

export default function NewCard() {
  const [form, setForm] = useState(empty)
  const [groups, setGroups] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => { api.listGroups().then(setGroups).catch(() => {}) }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const card = await api.createCard(form)
      navigate(`/cards/${card.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-head"><h1>Nueva tarjeta</h1></div>
      <form className="card" style={{ maxWidth: 640 }} onSubmit={submit}>
        <div className="field">
          <label>Nombre completo *</label>
          <input value={form.fullName} onChange={set('fullName')} required />
        </div>
        <div className="row">
          <div className="field"><label>Cargo</label><input value={form.jobTitle} onChange={set('jobTitle')} /></div>
          <div className="field"><label>Empresa</label><input value={form.company} onChange={set('company')} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set('email')} /></div>
          <div className="field"><label>Teléfono</label><input value={form.phone} onChange={set('phone')} /></div>
        </div>
        <div className="field"><label>Sitio web</label><input value={form.website} onChange={set('website')} /></div>
        <div className="field">
          <label>Grupo</label>
          <select value={form.groupId} onChange={set('groupId')}>
            <option value="">— Sin grupo —</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Notas</label><textarea rows={3} value={form.notes} onChange={set('notes')} /></div>
        <div className="field checkbox">
          <input id="se" type="checkbox" checked={form.sendEmail}
            onChange={(e) => setForm((f) => ({ ...f, sendEmail: e.target.checked }))} />
          <label htmlFor="se" style={{ margin: 0 }}>Enviar el pase por email al crearla</label>
        </div>

        {error && <p style={{ color: 'var(--red)' }}>{error}</p>}
        <button className="btn" disabled={saving}>
          {saving ? 'Creando…' : 'Crear pase + QR'}
        </button>
      </form>
    </>
  )
}
