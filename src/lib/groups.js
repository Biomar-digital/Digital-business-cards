// Lógica de agrupación (espejo de web/src/lib/groups.js) para usar en el Worker,
// p. ej. para poblar el dropdown de empresa del formulario público.

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

export function unifiedGroup(p) {
  const folder = String(p.folder_name || '').trim()
  const base = folder && folder !== '1' && !/templates/i.test(folder) ? folder : p.company || ''
  return canonicalGroup(base)
}

// Lista única y ordenada de grupos unificados presentes en los contactos.
export async function listUnifiedGroups(DB) {
  try {
    const { results } = await DB.prepare(
      'SELECT DISTINCT company, folder_name FROM contacts',
    ).all()
    const set = new Set()
    for (const r of results || []) {
      const g = unifiedGroup(r)
      if (g && g !== '—') set.add(g)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}
