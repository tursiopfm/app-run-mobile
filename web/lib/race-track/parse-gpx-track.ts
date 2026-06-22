import { XMLParser } from 'fast-xml-parser'

export interface TrackSample {
  distM: number       // distance cumulée depuis le départ (mètres)
  ele: number | null  // altitude (mètres) ; null si absente sur ce point
}

const R = 6_371_000
function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Parse un GPX en points {distance cumulée, altitude}. Mêmes conventions que
// lib/import/parse-gpx.ts (removeNSPrefix, trkpt). On ne garde PAS lat/lon
// (inutiles sans carte — YAGNI) : seules la distance cumulée et l'altitude servent.
export function parseGpxTrack(xml: string): { points: TrackSample[]; distanceM: number } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true })
  const doc = parser.parse(xml)
  const trk = doc?.gpx?.trk
  const trkArr = Array.isArray(trk) ? trk : trk ? [trk] : []
  const raw: { lat: number; lon: number; ele: number | null }[] = []
  for (const t of trkArr) {
    const segs = Array.isArray(t?.trkseg) ? t.trkseg : t?.trkseg ? [t.trkseg] : []
    for (const seg of segs) {
      const pts = Array.isArray(seg?.trkpt) ? seg.trkpt : seg?.trkpt ? [seg.trkpt] : []
      for (const p of pts) {
        const lat = Number(p?.['@_lat']), lon = Number(p?.['@_lon'])
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
        const eleNum = p?.ele != null ? Number(p.ele) : NaN
        raw.push({ lat, lon, ele: Number.isFinite(eleNum) ? eleNum : null })
      }
    }
  }
  if (raw.length < 2) throw new Error('GPX invalide : moins de 2 points de trace.')
  if (raw.every((p) => p.ele == null)) throw new Error('GPX invalide : aucune altitude.')

  const points: TrackSample[] = []
  let dist = 0
  for (let i = 0; i < raw.length; i++) {
    if (i > 0) dist += haversine(raw[i - 1].lat, raw[i - 1].lon, raw[i].lat, raw[i].lon)
    points.push({ distM: dist, ele: raw[i].ele })
  }
  return { points, distanceM: points[points.length - 1].distM }
}
