// Cliente API del panel. El token admin (si existe) se guarda en localStorage.
const TOKEN_KEY = 'dbc_admin_token'

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': getToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

export const api = {
  health: () => request('/health'),

  listCards: (groupId) => request(`/cards${groupId ? `?groupId=${groupId}` : ''}`),
  getCard: (id) => request(`/cards/${id}`),
  createCard: (payload) => request('/cards', { method: 'POST', body: payload }),
  sendCard: (id) => request(`/cards/${id}/send`, { method: 'POST' }),
  cardAnalytics: (id) => request(`/cards/${id}/analytics`),
  deleteCard: (id) => request(`/cards/${id}`, { method: 'DELETE' }),

  listGroups: () => request('/groups'),
  createGroup: (payload) => request('/groups', { method: 'POST', body: payload }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),

  listQr: () => request('/qr'),
  qrRaw: () => request('/qr/raw'),
  qrDetailSample: () => request('/qr/detail-sample'),
  qrVcardPage: () => request('/qr/vcard-page'),
  listPasses: () => request('/passes'),
  passesDebug: () => request('/passes/debug'),
  listTemplates: () => request('/templates'),

  listPeople: () => request('/people'),
  indexPeople: () => request('/people/index', { method: 'POST' }),
  syncPeople: () => request('/people/sync', { method: 'POST' }),
  resetPeople: () => request('/people/reset', { method: 'POST' }),
  createPasses: (qrIds, sendEmail) => request('/people/passes', { method: 'POST', body: { qrIds, sendEmail } }),
  sendIntroEmails: (qrIds) => request('/people/send-email', { method: 'POST', body: { qrIds } }),
  linkPasses: () => request('/people/link-passes', { method: 'POST' }),
  updatePerson: (qrId, fields) => request(`/people/${encodeURIComponent(qrId)}/update`, { method: 'POST', body: { fields } }),

  getHero: () => request('/hero'),
  setHero: (payload) => request('/hero/set', { method: 'POST', body: payload }),
  repushHero: (qrIds) => request('/hero/repush', { method: 'POST', body: { qrIds } }),

  createTestCard: () => request('/test/create-card', { method: 'POST' }),
  createExamplePass: () => request('/test/create-pass', { method: 'POST' }),

  listRequests: () => request('/requests'),
  resolveRequest: (id) => request(`/requests/${id}/status`, { method: 'POST', body: { status: 'done' } }),
}
