import { XMLParser } from 'fast-xml-parser'

export type ParsedGpx = {
  startTime: string
  durationSec: number
  movingTimeSec: number
  distanceM: number
  elevationGainM: number
  avgHr: number | null
  maxHr: number | null
  sportTypeHint: string | null
  pointCount: number
}

const R = 6_371_000
function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function parseGpx(xml: string): ParsedGpx {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true })
  const doc = parser.parse(xml)
  const trk = doc?.gpx?.trk
  const trkArr = Array.isArray(trk) ? trk : trk ? [trk] : []
  type Pt = { lat: number; lon: number; ele: number | null; time: string | null; hr: number | null }
  const points: Pt[] = []
  let sportTypeHint: string | null = null
  for (const t of trkArr) {
    if (sportTypeHint == null && typeof t?.type === 'string') sportTypeHint = t.type
    const segs = Array.isArray(t?.trkseg) ? t.trkseg : t?.trkseg ? [t.trkseg] : []
    for (const seg of segs) {
      const pts = Array.isArray(seg?.trkpt) ? seg.trkpt : seg?.trkpt ? [seg.trkpt] : []
      for (const p of pts) {
        const lat = Number(p?.['@_lat']); const lon = Number(p?.['@_lon'])
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
        const eleNum = p?.ele != null ? Number(p.ele) : NaN
        const time = typeof p?.time === 'string' ? p.time : null
        const ext = p?.extensions?.TrackPointExtension ?? p?.extensions
        const hrRaw = ext?.hr
        const hr = hrRaw != null && Number.isFinite(Number(hrRaw)) ? Number(hrRaw) : null
        points.push({ lat, lon, ele: Number.isFinite(eleNum) ? eleNum : null, time, hr })
      }
    }
  }
  if (points.length === 0) throw new Error('GPX invalide : aucun point de trace trouvé.')

  let distanceM = 0, elevationGainM = 0, movingTimeSec = 0
  const hrs: number[] = []
  for (let i = 0; i < points.length; i++) {
    if (points[i].hr != null) hrs.push(points[i].hr as number)
    if (i === 0) continue
    const prev = points[i - 1], cur = points[i]
    const d = haversine(prev.lat, prev.lon, cur.lat, cur.lon)
    distanceM += d
    if (prev.ele != null && cur.ele != null) { const up = cur.ele - prev.ele; if (up > 0) elevationGainM += up }
    if (prev.time && cur.time) {
      const dt = (new Date(cur.time).getTime() - new Date(prev.time).getTime()) / 1000
      if (dt > 0 && dt <= 10 && d > 0.3) movingTimeSec += dt
    }
  }
  const times = points.map(p => p.time).filter((t): t is string => !!t)
  const startTime = times[0] ?? new Date().toISOString()
  const durationSec = times.length >= 2
    ? Math.round((new Date(times[times.length - 1]).getTime() - new Date(times[0]).getTime()) / 1000)
    : 0
  const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null
  const maxHr = hrs.length ? Math.max(...hrs) : null
  return {
    startTime, durationSec,
    movingTimeSec: Math.round(movingTimeSec) || durationSec,
    distanceM: Math.round(distanceM),
    elevationGainM: Math.round(elevationGainM),
    avgHr, maxHr, sportTypeHint, pointCount: points.length,
  }
}
