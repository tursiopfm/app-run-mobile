// Allure en `mm:ss /km` ↔ secondes par km. Borne pratique : 1 km > 60s (jamais)
// et < 30 min (jamais sur une séance plausible).
const MIN_SEC_PER_KM = 90    // 1:30 /km (course rapide théorique)
const MAX_SEC_PER_KM = 1799  // 29:59 /km

export function parsePace(input: string): number | null {
  if (!input) return null
  const trimmed = input.trim()
  let mm: number
  let ss: number

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':')
    if (parts.length !== 2) return null
    mm = parseInt(parts[0], 10)
    ss = parseInt(parts[1], 10)
  } else if (/^\d{3,4}$/.test(trimmed)) {
    // "530" → 5:30, "1245" → 12:45
    const cut = trimmed.length - 2
    mm = parseInt(trimmed.slice(0, cut), 10)
    ss = parseInt(trimmed.slice(cut), 10)
  } else {
    return null
  }

  if (Number.isNaN(mm) || Number.isNaN(ss)) return null
  if (mm < 0 || ss < 0 || ss >= 60) return null
  const total = mm * 60 + ss
  if (total < MIN_SEC_PER_KM || total > MAX_SEC_PER_KM) return null
  return total
}

export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return ''
  const mm = Math.floor(secPerKm / 60)
  const ss = secPerKm % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}
