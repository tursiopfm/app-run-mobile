// Format minutes → "Hh:MMm" — ex: 90 → "1h30", 45 → "0h45".
export function formatDurationHHmm(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '0h00'
  const totalMin = Math.round(minutes)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

// Format minutes → "H:MM" pour usage compact — ex: 90 → "1:30".
export function formatDurationColon(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '0:00'
  const totalMin = Math.round(minutes)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

// Parse "1h30", "1:30", "90" → 90 minutes. Retourne null si invalide.
export function parseDurationToMinutes(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (s === '') return 0
  const hColon = s.match(/^(\d+)\s*[h:]\s*(\d{1,2})?$/)
  if (hColon) {
    const h = parseInt(hColon[1], 10)
    const m = hColon[2] ? parseInt(hColon[2], 10) : 0
    if (Number.isNaN(h) || Number.isNaN(m) || m >= 60) return null
    return h * 60 + m
  }
  const num = parseInt(s, 10)
  if (Number.isNaN(num) || num < 0) return null
  return num
}
