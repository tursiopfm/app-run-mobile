import { gpxToNormalized } from '@/lib/import/gpx-to-normalized'
import type { ParsedGpx } from '@/lib/import/parse-gpx'

const parsed: ParsedGpx = {
  startTime: '2026-05-01T08:00:00Z', durationSec: 3600, movingTimeSec: 3500,
  distanceM: 10000, elevationGainM: 300, avgHr: 150, maxHr: 175,
  sportTypeHint: 'running', pointCount: 500,
}
describe('gpxToNormalized', () => {
  it('construit une NormalizedActivity provider=gpx avec id déterministe', () => {
    const a = gpxToNormalized('user-1', parsed, 'Run', 'sortie.gpx')
    expect(a.provider).toBe('gpx')
    expect(a.sportType).toBe('Run')
    expect(a.distanceM).toBe(10000)
    expect(a.avgHr).toBe(150)
    expect(a.providerActivityId).toMatch(/^gpx_[0-9a-f]{16}$/)
    expect(gpxToNormalized('user-1', parsed, 'Run', 'autre.gpx').providerActivityId).toBe(a.providerActivityId)
  })
  it('nom par défaut dérivé du fichier si fourni', () => {
    expect(gpxToNormalized('u', parsed, 'Run', 'Trail du matin.gpx').name).toMatch(/trail du matin/i)
  })
})
