// Lógica compartida para agrupar/normalizar personas por empresa unificada.

// Normaliza un nombre (empresa o carpeta) al grupo canónico de BioMar.
export function canonicalGroup(name) {
  if (!name) return '—'
  const s = String(name).toLowerCase()
  const has = (...ks) => ks.some((k) => s.includes(k))
  if (has('aq1')) return 'AQ1 Systems'
  if (has('sagun')) return 'BioMar Sagun (Turkey)'
  if (has('norge', 'norway', 'karm')) return 'BioMar Norway'
  if (has('iberia', 'spain', 'españa', 'espana')) return 'BioMar Spain'
  if (has('ooo') || /\bru\b/.test(s) || has('russia')) return 'BioMar Russia'
  if (has('australia')) return 'BioMar Australia'
  if (has('chile')) return 'BioMar Chile'
  if (has('costa rica')) return 'BioMar Costa Rica'
  if (has('ecuador')) return 'BioMar Ecuador'
  if (/\buk\b/.test(s) || has('united kingdom')) return 'BioMar UK'
  if (has('france', 'emea')) return 'BioMar France'
  if (has('r&d')) return 'BioMar R&D'
  if (has('sourcing')) return 'BioMar Sourcing'
  if (has('sustainab')) return 'BioMar Sustainability'
  if (has('biomar')) return 'BioMar Group'
  return name
}

// Grupo final: la carpeta si es significativa, si no la empresa; todo normalizado.
export function unifiedGroup(p) {
  const folder = String(p.folder_name || '').trim()
  const base = folder && folder !== '1' && !/templates/i.test(folder) ? folder : p.company || ''
  return canonicalGroup(base)
}

// Filas de plantilla (nombre "* *" / email "*") que no son personas reales.
export function isPlaceholder(p) {
  const n = String(p.full_name || '').replace(/\s/g, '')
  return !n || /^\*+$/.test(n) || p.email === '*'
}
