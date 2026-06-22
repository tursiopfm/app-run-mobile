import { parseGpxTrack } from '@/lib/race-track/parse-gpx-track'
import { resampleProfile } from '@/lib/race-track/resample'

// 4 points, ~ montée puis descente. lat/lon espacés pour une distance non nulle.
const GPX = `<?xml version="1.0"?>
<gpx version="1.1"><trk><trkseg>
  <trkpt lat="45.900" lon="6.860"><ele>1000</ele></trkpt>
  <trkpt lat="45.905" lon="6.865"><ele>1200</ele></trkpt>
  <trkpt lat="45.910" lon="6.870"><ele>1100</ele></trkpt>
  <trkpt lat="45.915" lon="6.875"><ele>1300</ele></trkpt>
</trkseg></trk></gpx>`

describe('parseGpxTrack', () => {
  it('extrait les points avec distance cumulée croissante et altitude', () => {
    const { points, distanceM } = parseGpxTrack(GPX)
    expect(points).toHaveLength(4)
    expect(points[0]).toEqual({ distM: 0, ele: 1000 })
    expect(points[3].ele).toBe(1300)
    expect(points[1].distM).toBeGreaterThan(0)
    expect(points[3].distM).toBeGreaterThan(points[1].distM)
    expect(distanceM).toBe(points[3].distM)
  })

  it('lève si moins de 2 points', () => {
    expect(() => parseGpxTrack('<gpx><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>'))
      .toThrow()
  })

  it('lève si aucune altitude', () => {
    expect(() => parseGpxTrack(
      '<gpx><trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk></gpx>'))
      .toThrow()
  })
})

describe('resampleProfile', () => {
  it('scale l\'axe distance sur la distance officielle (dernier d == officialKm)', () => {
    const { points } = parseGpxTrack(GPX)
    const { d, e } = resampleProfile(points, 42)
    expect(d[0]).toBe(0)
    expect(d[d.length - 1]).toBeCloseTo(42, 3)
    expect(d.length).toBe(e.length)
    expect(d.length).toBeGreaterThanOrEqual(2)
    // distance strictement croissante
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1])
    // altitudes dans la plage réelle
    expect(Math.min(...e)).toBeGreaterThanOrEqual(1000)
    expect(Math.max(...e)).toBeLessThanOrEqual(1300)
  })

  it('borne le nombre de points (<= 801) sur un très long parcours', () => {
    const pts = Array.from({ length: 3 }, (_, i) => ({ distM: i * 100_000, ele: 1000 + i }))
    const { d } = resampleProfile(pts, 200)
    expect(d.length).toBeLessThanOrEqual(801)
  })

  it('interpole les altitudes nulles depuis les voisins connus', () => {
    const pts = [
      { distM: 0, ele: 1000 }, { distM: 100, ele: null }, { distM: 200, ele: 1200 },
    ]
    const { e } = resampleProfile(pts, 1)
    expect(Math.min(...e)).toBeGreaterThanOrEqual(1000)
    expect(Math.max(...e)).toBeLessThanOrEqual(1200)
  })
})
