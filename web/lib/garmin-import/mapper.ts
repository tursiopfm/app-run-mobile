// web/lib/garmin-import/mapper.ts
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import type { GarminSummaryActivity, GarminMapped, MapWarning } from './types'

const cmToM = (cm?: number) => (cm != null ? Math.round((cm / 100) * 10) / 10 : 0)
const msToS = (ms?: number) => (ms != null ? Math.round(ms / 1000) : 0)

function sportKey(t: GarminSummaryActivity['activityType']): string {
  if (!t) return 'other'
  return typeof t === 'string' ? t : (t.typeKey ?? 'other')
}

/** Sanity-check vitesse : avgSpeed (présumé m/s) doit être ≈ distance/durée à ±30 %. */
function speedWarning(a: GarminSummaryActivity, distanceM: number, movingSec: number, id: string): MapWarning | null {
  if (a.avgSpeed == null || distanceM <= 0 || movingSec <= 0) return null
  const expected = distanceM / movingSec
  const ratio = a.avgSpeed / expected
  if (ratio < 0.7 || ratio > 1.4) {
    return { activityId: id, field: 'avgSpeed', message: `avgSpeed=${a.avgSpeed} incohérent (attendu ≈ ${expected.toFixed(2)} m/s)` }
  }
  return null
}

export type MapOutcome = { result: GarminMapped | null; warning: MapWarning | null }

export function garminSummaryToMapped(userId: string, a: GarminSummaryActivity): MapOutcome {
  if (a.activityId == null) {
    return { result: null, warning: { activityId: '?', field: 'activityId', message: 'activityId manquant' } }
  }
  const id = String(a.activityId)
  const distanceM = cmToM(a.distance)
  const durationSec = msToS(a.duration)
  const movingTimeSec = msToS(a.movingDuration) || durationSec
  const localMs = a.startTimeLocal ?? a.beginTimestamp
  if (localMs == null) {
    return { result: null, warning: { activityId: id, field: 'startTime', message: 'aucun timestamp' } }
  }
  const startTime = new Date(localMs).toISOString()

  const normalized: NormalizedActivity = {
    userId,
    provider: 'garmin',
    providerActivityId: id,
    sportType: sportKey(a.activityType),
    name: a.activityName ?? 'Activité Garmin',
    startTime,
    durationSec,
    movingTimeSec,
    distanceM,
    elevationGainM: cmToM(a.elevationGain),
    avgHr: a.avgHr != null ? Math.round(a.avgHr) : null,
    maxHr: a.maxHr != null ? Math.round(a.maxHr) : null,
    avgPower: null,
    calories: a.calories != null ? Math.round(a.calories) : null,
    externalTrainingLoad: null,
    rawPayload: { source: 'garmin_gdpr', summary: a },
  }
  return {
    result: { normalized, elevationLossM: a.elevationLoss != null ? cmToM(a.elevationLoss) : null },
    warning: speedWarning(a, distanceM, movingTimeSec, id),
  }
}
