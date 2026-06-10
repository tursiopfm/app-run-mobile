import { buildActivityIndex, matchFit } from '@/lib/garmin-import/fit-match'
import type { EnrichCandidate } from '@/lib/garmin-import/enrich-types'

// startMs = instant UTC réel (GMT). Dans ces tests on l'aligne sur startTime pour lisibilité.
function cand(over: Partial<EnrichCandidate> & { startTime: string }): EnrichCandidate {
  return {
    id: 'x', provider: 'garmin', providerActivityId: 'x',
    startMs: Date.parse(over.startTime), ...over,
  } as EnrichCandidate
}

const cands: EnrichCandidate[] = [
  cand({ id: 'a', provider: 'garmin', providerActivityId: '111', startTime: '2024-01-01T08:00:00.000Z' }),
  cand({ id: 'b', provider: 'strava', providerActivityId: 's2', startTime: '2024-02-01T09:00:00.000Z' }),
]

test('match par activityId', () => {
  const idx = buildActivityIndex(cands)
  expect(matchFit({ activityId: '111', startTimeMs: 0 }, idx)?.id).toBe('a')
})

test('match par timestamp ±120 s (90 s)', () => {
  const idx = buildActivityIndex(cands)
  const ms = Date.parse('2024-02-01T09:01:30.000Z')
  expect(matchFit({ activityId: null, startTimeMs: ms }, idx)?.id).toBe('b')
})

test('hors tolérance (5 min) → null', () => {
  const idx = buildActivityIndex(cands)
  const ms = Date.parse('2024-02-01T09:05:00.000Z')
  expect(matchFit({ activityId: null, startTimeMs: ms }, idx)).toBeNull()
})

test('plusieurs candidats proches → le plus proche', () => {
  const idx = buildActivityIndex([
    cand({ id: 'x', provider: 'strava', providerActivityId: 'x', startTime: '2024-03-01T10:00:00.000Z' }),
    cand({ id: 'y', provider: 'strava', providerActivityId: 'y', startTime: '2024-03-01T10:01:00.000Z' }),
  ])
  const ms = Date.parse('2024-03-01T10:00:50.000Z') // 50 s de x, 10 s de y → y
  expect(matchFit({ activityId: null, startTimeMs: ms }, idx)?.id).toBe('y')
})

test('startTimeMs null → null', () => {
  const idx = buildActivityIndex(cands)
  expect(matchFit({ activityId: null, startTimeMs: null }, idx)).toBeNull()
})

test('matche sur startMs (GMT), pas sur start_time local étiqueté UTC', () => {
  // Activité à 08:00 locale (+2h) : start_time = "08:00Z" (label), mais startMs = 06:00Z réel.
  const c = cand({ id: 'tz', provider: 'garmin', providerActivityId: 'tz', startTime: '2024-06-01T08:00:00.000Z' })
  c.startMs = Date.parse('2024-06-01T06:00:00.000Z') // GMT réel
  const idx = buildActivityIndex([c])
  // Le FIT (GMT réel) à 06:00Z doit matcher ; le label local 08:00Z ne doit PAS.
  expect(matchFit({ activityId: null, startTimeMs: Date.parse('2024-06-01T06:00:30.000Z') }, idx)?.id).toBe('tz')
  expect(matchFit({ activityId: null, startTimeMs: Date.parse('2024-06-01T08:00:00.000Z') }, idx)).toBeNull()
})
