import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'

export default function CardDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [card, setCard] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.getCard(id).then(setCard).catch(() => {})
  useEffect(() => {
    load()
    api.cardAnalytics(id).then(setAnalytics).catch(() => {})
  }, [id])

  if (!card) return <div className="empty">Cargando…</div>

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  async function resend() {
    setBusy(true)
    try { await api.sendCard(id); flash('Pase enviado por email ✅'); load() }
    catch (e) { flash('Error: ' + e.message) }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm('¿Eliminar esta tarjeta, su pase y su QR?')) return
    await api.deleteCard(id)
    navigate('/cards')
  }

  return (
    <>
      <div className="page-head">
        <h1>{card.full_name} <span className={`badge ${card.status}`}>{card.status}</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={resend} disabled={busy || !card.email}>📧 Reenviar pase</button>
          <button className="btn danger" onClick={remove}>Eliminar</button>
        </div>
      </div>

      {card.last_error && <p style={{ color: 'var(--red)' }}>⚠️ {card.last_error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20 }}>
        <div className="card">
          <Row label="Cargo" value={card.job_title} />
          <Row label="Empresa" value={card.company} />
          <Row label="Email" value={card.email} />
          <Row label="Teléfono" value={card.phone} />
          <Row label="Sitio web" value={card.website} />
          <Row label="Pase wallet" value={card.pass_url} link />
          <Row label="QR (qrco.de)" value={card.qr_short_url} link />
          {analytics && <Row label="Escaneos" value={`${analytics.scans} (${analytics.unique} únicos)`} />}
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          {card.qr_image_url
            ? <img className="qr-img" src={card.qr_image_url} alt="QR" />
            : <span className="muted">Sin QR</span>}
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{card.qr_short_url}</p>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 28 }}>Historial de envíos</h2>
      {card.logs?.length ? (
        <table>
          <thead><tr><th>Fecha</th><th>Canal</th><th>Destino</th><th>Estado</th></tr></thead>
          <tbody>
            {card.logs.map((l) => (
              <tr key={l.id}>
                <td className="muted">{l.created_at}</td>
                <td>{l.channel}</td>
                <td className="muted">{l.to_address}</td>
                <td><span className={`badge ${l.status === 'sent' ? 'active' : 'error'}`}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="muted">Sin envíos todavía.</p>}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

function Row({ label, value, link }) {
  return (
    <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="muted" style={{ width: 140 }}>{label}</div>
      <div style={{ flex: 1 }}>
        {!value ? '—' : link ? <a href={value} target="_blank" rel="noreferrer">{value}</a> : value}
      </div>
    </div>
  )
}
