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

