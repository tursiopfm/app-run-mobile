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

// Dégradé d'allure continu, aligné charte Deep Mission :
// le plus rapide → orange, puis jaune, vert, et bleu pour le plus lent.
// `minPace` ancre le chaud (le meilleur km), `avgPace × 1.12` ancre le froid
// (au-delà — typiquement une côte marchée — la couleur sature en bleu).
const PACE_GRADIENT_STOPS: { t: number; rgb: [number, number, number] }[] = [
  { t: 0,    rgb: [255, 121, 0]   }, // #FF7900 orange — le plus rapide
  { t: 0.34, rgb: [251, 191, 36]  }, // #FBBF24 jaune
  { t: 0.67, rgb: [74, 222, 128]  }, // #4ADE80 vert
  { t: 1,    rgb: [56, 189, 248]  }, // #38BDF8 bleu — le plus lent
]

const toHex = (v: number) =>
  Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')

export function paceGradientColor(pace: number, minPace: number, avgPace: number): string {
  if (!avgPace || !Number.isFinite(pace)) return '#8892a4'
  const hi = Math.max(avgPace * 1.12, minPace + 1)
  let t = (pace - minPace) / (hi - minPace)
  t = Math.max(0, Math.min(1, t))
  for (let i = 0; i < PACE_GRADIENT_STOPS.length - 1; i++) {
    const a = PACE_GRADIENT_STOPS[i]
    const b = PACE_GRADIENT_STOPS[i + 1]
    if (t <= b.t) {
      const f = (t - a.t) / (b.t - a.t)
      const c = a.rgb.map((v, k) => v + (b.rgb[k] - v) * f)
      return `#${toHex(c[0])}${toHex(c[1])}${toHex(c[2])}`
    }
  }
  return '#38bdf8'
}

// ── Lap utilities ─────────────────────────────────────────────────────────────

export function lapPaceSec(
  lap: Pick<StravaLap, 'average_speed'>
): number | null {
  if (lap.average_speed <= 0) return null
  return Math.round(1000 / lap.average_speed)
}

// Detection tuning. The fast "effort" laps are found by growing a cluster from
// the fastest lap and stopping at the first significant gap in sorted pace.
// This avoids the old median-based threshold, which over-detected: on a session
// with slow recoveries the median is dragged up, so moderate warm-up / cool-down
// laps fall under `median × 0.95` and get wrongly flagged (e.g. a 4:23 jog beside
// 3:45 efforts). Referencing the gap from the fast side ignores the slow laps.
const FRAC_MIN_SPREAD = 0.12   // slowest must be ≥12% slower than fastest, else it's a steady run
const FRAC_GAP_REL    = 0.12   // a ≥12% jump between sorted paces…
const FRAC_GAP_ABS    = 12     // …AND ≥12 s/km marks the fast-cluster boundary

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
  const pMin = sorted[0]
  const pMax = sorted[sorted.length - 1]
  if (pMin <= 0) return new Set()

  // No real spread → uniform/steady effort, nothing to flag.
  if ((pMax - pMin) / pMin < FRAC_MIN_SPREAD) return new Set()

  // Grow the fast cluster from the fastest pace until a significant gap appears.
  let clusterMax = pMin
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    const relGap = (cur - prev) / prev
    const absGap = cur - prev
    if (relGap > FRAC_GAP_REL && absGap > FRAC_GAP_ABS) break
    clusterMax = cur
  }

  // The cluster swallowed every lap (no clear fast/slow separation) → not intervals.
  if (clusterMax >= pMax) return new Set()

  const fast = new Set<number>()
  for (const { split, pace } of validPaces) {
    if (pace <= clusterMax) fast.add(split)
  }
  return fast
}

// ── Fractionné structure (phases + grouped efforts) ─────────────────────────────

export type FracLapRow = {
  index: number              // display number = split ?? lap_index + 1
  distance: number           // metres
  movingTime: number         // seconds
  paceSec: number | null     // sec/km
  elevation: number          // metres D+
}

export type FracEffort = {
  rep: number                // 1-based effort number
  laps: FracLapRow[]         // contiguous fast laps merged into this effort
  distance: number
  movingTime: number
  paceSec: number | null
}

export type FracPhase = {
  kind: 'warmup' | 'recovery' | 'cooldown'
  laps: FracLapRow[]
  distance: number
  movingTime: number
  paceSec: number | null
}

export type FracItem =
  | { type: 'effort'; effort: FracEffort }
  | { type: 'recovery'; phase: FracPhase }

export type FractionneAnalysis = {
  isInterval: boolean
  rows: FracLapRow[]                 // every lap, ordered (used by the flat fallback)
  warmup: FracPhase | null
  cooldown: FracPhase | null
  efforts: FracEffort[]
  items: FracItem[]                  // ordered efforts + recoveries between warm-up & cool-down
  structureLabel: string             // e.g. "3 × 2 000 m + 1 000 m"
  avgEffortPaceSec: number | null
  avgRecoverySec: number | null      // avg recovery duration (seconds)
  fastLapIndexes: Set<number>
}

function fracRow(lap: StravaLap): FracLapRow {
  return {
    index: lap.split ?? (lap.lap_index + 1),
    distance: lap.distance,
    movingTime: lap.moving_time,
    paceSec: lapPaceSec(lap),
    elevation: Math.round(lap.total_elevation_gain ?? 0),
  }
}

function fracCumul(rows: FracLapRow[]): { distance: number; movingTime: number; paceSec: number | null } {
  const distance = rows.reduce((s, r) => s + r.distance, 0)
  const movingTime = rows.reduce((s, r) => s + r.movingTime, 0)
  const paceSec = distance > 0 ? Math.round(movingTime / (distance / 1000)) : null
  return { distance, movingTime, paceSec }
}

// Round an effort distance to a "nice" rep length for the structure label.
function roundRepDist(m: number): number {
  if (m >= 1000) return Math.round(m / 100) * 100   // nearest 100 m (2 040 → 2 000)
  return Math.round(m / 50) * 50                      // nearest 50 m (228 → … not used for efforts)
}

function fmtRepDist(m: number): string {
  const r = roundRepDist(m)
  if (r >= 1000) {
    const s = String(r)
    return `${s.slice(0, s.length - 3)} ${s.slice(s.length - 3)} m`  // "2 000 m"
  }
  return `${r} m`
}

function fracStructureLabel(efforts: FracEffort[]): string {
  if (efforts.length === 0) return ''
  const groups: { dist: number; count: number }[] = []
  for (const e of efforts) {
    const dist = roundRepDist(e.distance)
    const last = groups[groups.length - 1]
    if (last && last.dist === dist) last.count++
    else groups.push({ dist, count: 1 })
  }
  return groups
    .map(g => `${g.count > 1 ? `${g.count} × ` : ''}${fmtRepDist(g.dist)}`)
    .join(' + ')
}

/**
 * Reconstruct the structure of an interval session from its laps:
 * warm-up (laps before the first effort), cool-down (after the last),
 * recoveries (slow laps between efforts), and efforts — where contiguous fast
 * laps are merged into one effort (a 2 000 m rep auto-lapped into 2×1 km becomes
 * a single cumulated block).
 */
export function analyzeFractionne(laps: StravaLap[]): FractionneAnalysis {
  const rows = laps.map(fracRow)
  const fastSet = detectFastLaps(laps)

  const base: FractionneAnalysis = {
    isInterval: false,
    rows,
    warmup: null,
    cooldown: null,
    efforts: [],
    items: [],
    structureLabel: '',
    avgEffortPaceSec: null,
    avgRecoverySec: null,
    fastLapIndexes: fastSet,
  }

  const firstFast = rows.findIndex(r => fastSet.has(r.index))
  if (firstFast === -1) return base
  let lastFast = firstFast
  for (let i = rows.length - 1; i >= 0; i--) {
    if (fastSet.has(rows[i].index)) { lastFast = i; break }
  }

  const warmRows = rows.slice(0, firstFast)
  const coolRows = rows.slice(lastFast + 1)
  const middle = rows.slice(firstFast, lastFast + 1)

  const warmup: FracPhase | null = warmRows.length
    ? { kind: 'warmup', laps: warmRows, ...fracCumul(warmRows) }
    : null
  const cooldown: FracPhase | null = coolRows.length
    ? { kind: 'cooldown', laps: coolRows, ...fracCumul(coolRows) }
    : null

  const efforts: FracEffort[] = []
  const items: FracItem[] = []
  let i = 0
  let rep = 0
  while (i < middle.length) {
    const isFast = fastSet.has(middle[i].index)
    let j = i
    while (j < middle.length && fastSet.has(middle[j].index) === isFast) j++
    const group = middle.slice(i, j)
    if (isFast) {
      rep++
      const effort: FracEffort = { rep, laps: group, ...fracCumul(group) }
      efforts.push(effort)
      items.push({ type: 'effort', effort })
    } else {
      const phase: FracPhase = { kind: 'recovery', laps: group, ...fracCumul(group) }
      items.push({ type: 'recovery', phase })
    }
    i = j
  }

  const totalEffortDist = efforts.reduce((s, e) => s + e.distance, 0)
  const totalEffortTime = efforts.reduce((s, e) => s + e.movingTime, 0)
  const avgEffortPaceSec = totalEffortDist > 0
    ? Math.round(totalEffortTime / (totalEffortDist / 1000))
    : null

  const recoveries = items.filter((it): it is { type: 'recovery'; phase: FracPhase } => it.type === 'recovery')
  const avgRecoverySec = recoveries.length
    ? Math.round(recoveries.reduce((s, it) => s + it.phase.movingTime, 0) / recoveries.length)
    : null

  return {
    isInterval: true,
    rows,
    warmup,
    cooldown,
    efforts,
    items,
    structureLabel: fracStructureLabel(efforts),
    avgEffortPaceSec,
    avgRecoverySec,
    fastLapIndexes: fastSet,
  }
}

export function fmtLapDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}

