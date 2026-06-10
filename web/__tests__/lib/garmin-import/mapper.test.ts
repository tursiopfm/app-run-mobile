// web/__tests__/lib/garmin-import/mapper.test.ts
import { garminSummaryToMapped, garminSportToCanonical } from '@/lib/garmin-import/mapper'
import type { GarminSummaryActivity } from '@/lib/garmin-import/types'

const base: GarminSummaryActivity = {
  activityId: 123456789,
  activityType: 'trail_running',
  beginTimestamp: 1_600_000_000_000,
  startTimeLocal: 1_600_007_200_000, // +2h (local labellisé)
  distance: 1_050_000,   // cm → 10500 m
  duration: 3_600_000,   // ms → 3600 s
  movingDuration: 3_500_000, // ms → 3500 s
  elevationGain: 55_000, // cm → 550 m
  elevationLoss: 60_000, // cm → 600 m
  avgHr: 150,
  maxHr: 175,
  calories: 800,
  activityName: 'Sortie trail',
}

test('convertit les unités Garmin (cm→m, ms→s, epoch→ISO) et mappe le sport', () => {
  const { normalized, elevationLossM } = garminSummaryToMapped('user-1', base).result!
  expect(normalized.provider).toBe('garmin')
  expect(normalized.providerActivityId).toBe('123456789')
  expect(normalized.sportType).toBe('TrailRun')
  expect(normalized.distanceM).toBe(10500)
  expect(normalized.durationSec).toBe(3600)
  expect(normalized.movingTimeSec).toBe(3500)
  expect(normalized.elevationGainM).toBe(550)
  expect(normalized.avgHr).toBe(150)
  expect(normalized.maxHr).toBe(175)
  expect(elevationLossM).toBe(600)
  // start_time = heure locale étiquetée UTC (convention repo) → dérivé de startTimeLocal
  expect(normalized.startTime).toBe(new Date(1_600_007_200_000).toISOString())
})

test('activityType objet { typeKey } supporté + canonicalisé', () => {
  const { normalized } = garminSummaryToMapped('u', { ...base, activityType: { typeKey: 'running' } }).result!
  expect(normalized.sportType).toBe('Run')
})

test('garminSportToCanonical : clés Garmin → types canoniques de l’app', () => {
  expect(garminSportToCanonical('running')).toBe('Run')
  expect(garminSportToCanonical('treadmill_running')).toBe('Run')
  expect(garminSportToCanonical('trail_running')).toBe('TrailRun')
  expect(garminSportToCanonical('cycling')).toBe('Ride')
  expect(garminSportToCanonical('mountain_biking')).toBe('Ride')
  expect(garminSportToCanonical('indoor_cycling')).toBe('VirtualRide')
  expect(garminSportToCanonical('virtual_ride')).toBe('VirtualRide')
  expect(garminSportToCanonical('lap_swimming')).toBe('Swim')
  expect(garminSportToCanonical('open_water_swimming')).toBe('Swim')
  expect(garminSportToCanonical('hiking')).toBe('Hike')
  expect(garminSportToCanonical('walking')).toBe('Walk')
  // type inconnu → passthrough (apparaît au moins dans "Tout")
  expect(garminSportToCanonical('strength_training')).toBe('strength_training')
})

test('sans activityId → erreur, pas de crash', () => {
  const out = garminSummaryToMapped('u', { ...base, activityId: undefined })
  expect(out.result).toBeNull()
  expect(out.warning?.field).toBe('activityId')
})

test('incohérence vitesse/distance/durée → warning mais mappe quand même', () => {
  // distance 10500 m / 3500 s ≈ 3.0 m/s ; avgSpeed 30 (incohérent d'un facteur 10)
  const out = garminSummaryToMapped('u', { ...base, avgSpeed: 30 })
  expect(out.result).not.toBeNull()
  expect(out.warning?.field).toBe('avgSpeed')
})

test('calories fractionnaires Garmin → arrondies (colonne integer)', () => {
  const { normalized } = garminSummaryToMapped('u', { ...base, calories: 100.56047999999998 }).result!
  expect(normalized.calories).toBe(101)
})
