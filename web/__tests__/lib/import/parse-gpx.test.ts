import { parseGpx } from '@/lib/import/parse-gpx'

const SAMPLE = `<?xml version="1.0"?>
<gpx xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
 <trk><type>running</type><trkseg>
  <trkpt lat="45.0000" lon="6.0000"><ele>1000</ele><time>2026-05-01T08:00:00Z</time>
   <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
  <trkpt lat="45.0010" lon="6.0000"><ele>1010</ele><time>2026-05-01T08:00:30Z</time>
   <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
  <trkpt lat="45.0020" lon="6.0000"><ele>1005</ele><time>2026-05-01T08:01:00Z</time>
   <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>160</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
 </trkseg></trk>
</gpx>`

describe('parseGpx', () => {
  it('extrait les métriques de base', () => {
    const r = parseGpx(SAMPLE)
    expect(r.startTime).toBe('2026-05-01T08:00:00Z')
    expect(r.durationSec).toBe(60)
    expect(r.pointCount).toBe(3)
    expect(r.elevationGainM).toBe(10)
    expect(r.avgHr).toBe(150)
    expect(r.maxHr).toBe(160)
    expect(r.sportTypeHint).toBe('running')
    expect(r.distanceM).toBeGreaterThan(200)
  })
  it('gère un GPX sans hr ni ele', () => {
    const r = parseGpx(`<gpx><trk><trkseg>
      <trkpt lat="45.0" lon="6.0"><time>2026-05-01T08:00:00Z</time></trkpt>
      <trkpt lat="45.001" lon="6.0"><time>2026-05-01T08:00:30Z</time></trkpt>
    </trkseg></trk></gpx>`)
    expect(r.avgHr).toBeNull(); expect(r.maxHr).toBeNull(); expect(r.elevationGainM).toBe(0)
    expect(r.pointCount).toBe(2)
  })
  it('lève une erreur claire si aucun trackpoint', () => {
    expect(() => parseGpx('<gpx></gpx>')).toThrow(/aucun point/i)
  })
})
