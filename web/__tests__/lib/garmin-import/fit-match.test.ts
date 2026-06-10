import { buildActivityIndex, matchFit } from '@/lib/garmin-import/fit-match'
import type { EnrichCandidate } from '@/lib/garmin-import/enrich-types'

const cands: EnrichCandidate[] = [
  { id: 'a', provider: 'garmin', providerActivityId: '111', startTime: '2024-01-01T08:00:00.000Z' },
  { id: 'b', provider: 'strava', providerActivityId: 's2',  startTime: '2024-02-01T09:00:00.000Z' },
]

test('match par activityId', () => {
  const idx = buildActivityIndex(cands)
  expect(matchFit({ activityId: '111', startTimeMs: 0 }, idx)?.id).toBe('a')
})

test('match par timestamp ±120 s (90 s)', () => {
  const idx = buildActivityIndex(cands)
  const ms = new Date('2024-02-01T09:01:30.000Z').getTime()
  expect(matchFit({ activityId: null, startTimeMs: ms }, idx)?.id).toBe('b')
})

test('hors tolérance (5 min) → null', () => {
  const idx = buildActivityIndex(cands)
  const ms = new Date('2024-02-01T09:05:00.000Z').getTime()
  expect(matchFit({ activityId: null, startTimeMs: ms }, idx)).toBeNull()
})

test('plusieurs candidats proches → le plus proche', () => {
  const close: EnrichCandidate[] = [
    { id: 'x', provider: 'strava', providerActivityId: 'x', startTime: '2024-03-01T10:00:00.000Z' },
    { id: 'y', provider: 'strava', providerActivityId: 'y', startTime: '2024-03-01T10:01:00.000Z' },
  ]
  const idx = buildActivityIndex(close)
  const ms = new Date('2024-03-01T10:00:50.000Z').getTime() // 50 s de x, 10 s de y → y
  expect(matchFit({ activityId: null, startTimeMs: ms }, idx)?.id).toBe('y')
})

test('startTimeMs null → null', () => {
  const idx = buildActivityIndex(cands)
  expect(matchFit({ activityId: null, startTimeMs: null }, idx)).toBeNull()
})
