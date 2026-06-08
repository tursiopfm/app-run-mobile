import { createHash } from 'crypto'
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import type { ParsedGpx } from '@/lib/import/parse-gpx'

export function gpxToNormalized(
  userId: string,
  p: ParsedGpx,
  sportType: string,
  fileName?: string,
): NormalizedActivity {
  const hash = createHash('sha1')
    .update(`${p.startTime}|${p.distanceM}|${p.durationSec}`)
    .digest('hex').slice(0, 16)
  const baseName = fileName?.replace(/\.gpx$/i, '').trim()
  const name = baseName && baseName.length > 0 ? baseName : 'Activité importée'
  return {
    userId,
    provider: 'gpx',
    providerActivityId: `gpx_${hash}`,
    sportType,
    name,
    startTime: p.startTime,
    durationSec: p.durationSec,
    movingTimeSec: p.movingTimeSec,
    distanceM: p.distanceM,
    elevationGainM: p.elevationGainM,
    avgHr: p.avgHr,
    maxHr: p.maxHr,
    avgPower: null,
    calories: null,
    externalTrainingLoad: null,
    rawPayload: { source: 'gpx', fileName: fileName ?? null, parsed: p },
  }
}
