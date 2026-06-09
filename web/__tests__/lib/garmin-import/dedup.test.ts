// web/__tests__/lib/garmin-import/dedup.test.ts
import { matchesExisting, classifyActivities } from '@/lib/garmin-import/dedup'
import type { ExistingActivity, GarminMapped } from '@/lib/garmin-import/types'

function mapped(over: Partial<GarminMapped['normalized']>): GarminMapped {
  return {
    normalized: {
      userId: 'u', provider: 'garmin', providerActivityId: '1', sportType: 'running',
      name: 'x', startTime: '2024-01-01T08:00:00.000Z', durationSec: 3600, movingTimeSec: 3600,
      distanceM: 10000, elevationGainM: 100, avgHr: 150, maxHr: 170, avgPower: null,
      calories: null, externalTrainingLoad: null, rawPayload: {}, ...over,
    },
    elevationLossM: 100,
  }
}
function existing(over: Partial<ExistingActivity>): ExistingActivity {
  return {
    id: 'e1', provider: 'strava', providerActivityId: 's1',
    startTime: '2024-01-01T08:00:00.000Z', movingTimeSec: 3600, durationSec: 3600,
    distanceM: 10000, avgHr: 150, elevationGainM: 100, ...over,
  }
}

test('match exact', () => {
  expect(matchesExisting(mapped({}).normalized, existing({}))).toBe(true)
})
test('décalage 90 s + 0.5 % distance + 0.5 % durée → match', () => {
  expect(matchesExisting(
    mapped({ startTime: '2024-01-01T08:01:30.000Z', distanceM: 10050, movingTimeSec: 3618 }).normalized,
    existing({}),
  )).toBe(true)
})
test('décalage 3 min → pas de match', () => {
  expect(matchesExisting(mapped({ startTime: '2024-01-01T08:03:00.000Z' }).normalized, existing({}))).toBe(false)
})
test('distance +5 % → pas de match', () => {
  expect(matchesExisting(mapped({ distanceM: 10500 }).normalized, existing({}))).toBe(false)
})

test('classifyActivities sépare nouvelles et conflits, défaut keep_strava', () => {
  const a = mapped({ providerActivityId: '1', startTime: '2024-01-01T08:00:00.000Z' })   // conflit
  const b = mapped({ providerActivityId: '2', startTime: '2024-06-01T08:00:00.000Z' })   // nouvelle
  const { nouvelles, conflits } = classifyActivities([a, b], [existing({})])
  expect(nouvelles.map(n => n.normalized.providerActivityId)).toEqual(['2'])
  expect(conflits).toHaveLength(1)
  expect(conflits[0].decision).toBe('keep_strava')
  expect(conflits[0].existing.id).toBe('e1')
})
