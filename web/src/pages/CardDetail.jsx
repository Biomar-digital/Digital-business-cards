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

  if (!card) return <div className="empty">Loading…</div>

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  async function resend() {
    setBusy(true)
    try { await api.sendCard(id); flash('Pass sent by email ✅'); load() }
    catch (e) { flash('Error: ' + e.message) }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm('Delete this card, its pass and its QR?')) return
    await api.deleteCard(id)
    navigate('/cards')
  }

  return (
    <>
      <div className="page-head">
        <h1>{card.full_name} <span className={`badge ${card.status}`}>{card.status}</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={resend} disabled={busy || !card.email}>Resend pass</button>
          <button className="btn danger" onClick={remove}>Delete</button>
        </div>
      </div>

      {card.last_error && <p style={{ color: 'var(--red)' }}>⚠️ {card.last_error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20 }}>
        <div className="card">
          <Row label="Job title" value={card.job_title} />
          <Row label="Company" value={card.company} />
          <Row label="Email" value={card.email} />
          <Row label="Phone" value={card.phone} />
          <Row label="Website" value={card.website} />
          <Row label="Wallet pass" value={card.pass_url} link />
          <Row label="QR (qrco.de)" value={card.qr_short_url} link />
          {analytics && <Row label="Scans" value={`${analytics.scans} (${analytics.unique} unique)`} />}
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          {card.qr_image_url
            ? <img className="qr-img" src={card.qr_image_url} alt="QR" />
            : <span className="muted">No QR</span>}
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{card.qr_short_url}</p>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 28 }}>Send history</h2>
      {card.logs?.length ? (
        <table>
          <thead><tr><th>Date</th><th>Channel</th><th>Recipient</th><th>Status</th></tr></thead>
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
      ) : <p className="muted">No sends yet.</p>}

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
