// ── Types ─────────────────────────────────────────────────────────────────────

export type StravaSplit = {
  split: number
  distance: number
  elapsed_time: number
  moving_time: number
  elevation_difference: number
  average_speed: number
  pace_zone: number
}

export type HrZone = {
  label: string
  color: string
  minPct: number
  maxPct: number
  durationSec: number
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmtPaceSec(sec: number | null): string {
  if (!sec) return '—'
  const totalSecs = Math.round(sec)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function fmtDurationSec(sec: number | null): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m}min`
}

// ── Split utilities ───────────────────────────────────────────────────────────

export function splitPaceSec(
  split: Pick<StravaSplit, 'moving_time' | 'distance'>
): number | null {
  if (!split.distance) return null
  return Math.round((split.moving_time / split.distance) * 1000)
}

export function splitColor(splitPace: number, avgPace: number): string {
  if (!avgPace) return '#8892a4'
  const ratio = (splitPace - avgPace) / avgPace
  if (ratio <= -0.10) return '#e8651a'  // ≥10% faster → orange/red (max effort)
  if (ratio <= 0)     return '#ff7043'  // faster → orange
  if (ratio <= 0.10)  return '#ffb300'  // slightly slower → yellow
  if (ratio <= 0.20)  return '#8bc34a'  // slower → light green
  return '#4caf50'                       // ≥20% slower → green (easy)
}

// ── Heart rate zones ──────────────────────────────────────────────────────────

const ZONE_DEFS = [
  { label: 'Z1 Récup',   color: '#42a5f5', minPct: 0,    maxPct: 0.60, center: 0.30 },
  { label: 'Z2 Aérobie', color: '#66bb6a', minPct: 0.60, maxPct: 0.70, center: 0.65 },
  { label: 'Z3 Tempo',   color: '#ffb300', minPct: 0.70, maxPct: 0.80, center: 0.75 },
  { label: 'Z4 Seuil',   color: '#ff7043', minPct: 0.80, maxPct: 0.90, center: 0.85 },
  { label: 'Z5 VO2max',  color: '#e8651a', minPct: 0.90, maxPct: 1.00, center: 0.95 },
]

export function estimateHrZones(
  avgHr: number,
  maxHr: number,
  movingTimeSec: number
): HrZone[] {
  const avgPct = avgHr / maxHr
  const sigma = 0.08

  const rawWeights = ZONE_DEFS.map(z =>
    Math.exp(-0.5 * ((avgPct - z.center) / sigma) ** 2)
  )
  const total = rawWeights.reduce((s, w) => s + w, 0)

  // Distribute time proportionally, ensuring integers sum exactly to movingTimeSec
  let remaining = movingTimeSec
  const durations = rawWeights.map((w, i) => {
    if (i === rawWeights.length - 1) return remaining
    const d = Math.round((w / total) * movingTimeSec)
    remaining -= d
    return d
  })

  return ZONE_DEFS.map((z, i) => ({
    label:       z.label,
    color:       z.color,
    minPct:      z.minPct,
    maxPct:      z.maxPct,
    durationSec: durations[i],
  }))
}
