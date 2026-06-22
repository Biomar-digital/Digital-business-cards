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
  listPasses: () => request('/passes'),
  passesDebug: () => request('/passes/debug'),
  listTemplates: () => request('/templates'),
}
