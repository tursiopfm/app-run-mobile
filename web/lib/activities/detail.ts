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

export type StravaLap = {
  id: number
  name: string
  elapsed_time: number
  moving_time: number
  distance: number
  average_speed: number
  total_elevation_gain: number
  lap_index: number
  split?: number
  average_heartrate?: number
  max_heartrate?: number
  pace_zone?: number
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
  const s = Math.round(sec % 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
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

// ── Lap utilities ─────────────────────────────────────────────────────────────

export function lapPaceSec(
  lap: Pick<StravaLap, 'average_speed'>
): number | null {
  if (lap.average_speed <= 0) return null
  return Math.round(1000 / lap.average_speed)
}

export function detectFastLaps(laps: StravaLap[]): Set<number> {
  if (laps.length < 2) return new Set()

  const pacePairs = laps.map(lap => ({
    split: lap.split ?? (lap.lap_index + 1),
    pace: lap.average_speed > 0 ? 1000 / lap.average_speed : null,
  }))

  const validPaces = pacePairs
    .filter((p): p is { split: number; pace: number } => p.pace !== null)

  if (validPaces.length < 2) return new Set()

  const sorted = [...validPaces.map(p => p.pace)].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]

  const threshold = median * 0.95

  const fast = new Set<number>()
  for (const { split, pace } of validPaces) {
    if (pace < threshold) fast.add(split)
  }
  return fast
}

export function fmtLapDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}

