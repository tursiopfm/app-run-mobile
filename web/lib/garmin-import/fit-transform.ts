import type { StreamSet } from '@/lib/activities/stream-metrics'

export type FitRecord = {
  timestamp?: Date
  heartRate?: number
  altitude?: number
  enhancedAltitude?: number
  speed?: number
  enhancedSpeed?: number
  distance?: number
  positionLat?: number   // semicircles
  positionLong?: number  // semicircles
}

// FIT positions sont en "semicircles" : degrés = semicircles × 180 / 2^31.
const SEMICIRCLE_TO_DEG = 180 / 2 ** 31

/** Pente (%) par échantillon : Δaltitude/Δdistance ; 0 au 1er point et si distance ~plate. */
export function deriveGrade(altitude: number[], distance: number[]): number[] {
  const n = Math.min(altitude.length, distance.length)
  const out: number[] = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    const dd = distance[i] - distance[i - 1]
    out[i] = dd > 0.5 ? ((altitude[i] - altitude[i - 1]) / dd) * 100 : 0
  }
  return out
}

/** Si tout le canal est NaN → undefined (canal absent), sinon le tableau. */
function channel(arr: number[]): number[] | undefined {
  return arr.some(v => !Number.isNaN(v)) ? arr : undefined
}

export function recordsToStreamSet(records: FitRecord[]): StreamSet {
  const usable = records.filter(r => r.timestamp instanceof Date)
  if (usable.length === 0) return {}
  const t0 = usable[0].timestamp!.getTime()
  const time: number[] = [], altitude: number[] = [], heartrate: number[] = [], velocity: number[] = [], distance: number[] = []
  const latlng: [number, number][] = []
  for (const r of usable) {
    time.push(Math.round((r.timestamp!.getTime() - t0) / 1000))
    altitude.push(r.enhancedAltitude ?? r.altitude ?? NaN)
    heartrate.push(r.heartRate ?? NaN)
    velocity.push(r.enhancedSpeed ?? r.speed ?? NaN)
    distance.push(r.distance ?? NaN)
    latlng.push(r.positionLat != null && r.positionLong != null
      ? [r.positionLat * SEMICIRCLE_TO_DEG, r.positionLong * SEMICIRCLE_TO_DEG]
      : [NaN, NaN])
  }
  const alt = channel(altitude)
  const dist = channel(distance)
  return {
    time,
    altitude: alt,
    heartrate: channel(heartrate),
    velocity: channel(velocity),
    distance: dist,
    grade: alt && dist ? deriveGrade(alt, dist) : undefined,
    latlng: latlng.some(([la]) => !Number.isNaN(la)) ? latlng : undefined,
  }
}

/** Downsample par fenêtre de `everyS` s (1er point/fenêtre + dernier garanti). */
export function downsample5s(s: StreamSet, everyS = 5): StreamSet {
  const t = s.time
  if (!t || t.length === 0) return s
  const keep: number[] = []
  let next = -Infinity
  for (let i = 0; i < t.length; i++) if (t[i] >= next) { keep.push(i); next = t[i] + everyS }
  if (keep[keep.length - 1] !== t.length - 1) keep.push(t.length - 1)
  const pick = (a?: number[]) => (a ? keep.map(i => a[i]) : undefined)
  return {
    time: pick(s.time), altitude: pick(s.altitude), heartrate: pick(s.heartrate),
    velocity: pick(s.velocity), distance: pick(s.distance), grade: pick(s.grade),
    latlng: s.latlng ? keep.map(i => s.latlng![i]) : undefined,
  }
}
