import { processStreamsBackfillBatch } from '@/lib/providers/strava/streams-backfill'
import { recalculateUserEffortScores, recalculateUserFatigue } from '@/lib/sync/recalculate-scores'

jest.mock('@/lib/providers/strava/token', () => ({
  getValidStravaToken: jest.fn().mockResolvedValue('tok'),
}))
jest.mock('@/lib/providers/strava/streams', () => {
  const actual = jest.requireActual('@/lib/providers/strava/streams')
  return {
    ...actual,
    fetchStravaStreams: jest.fn().mockResolvedValue({
      time: [0, 1], altitude: [10, 5], velocity: [3, 3], grade: [0, 0], heartrate: [150, 150],
    }),
  }
})
jest.mock('@/lib/sync/recalculate-scores', () => ({
  recalculateUserEffortScores: jest.fn().mockResolvedValue({ recalculated: 0, errors: 0 }),
  recalculateUserFatigue: jest.fn().mockResolvedValue(undefined),
}))

const upsert = jest.fn().mockResolvedValue({ error: null })
const rpc = jest.fn().mockResolvedValue({
  data: [
    { id: 'a1', user_id: 'u1', provider_activity_id: '111' },
    { id: 'a2', user_id: 'u1', provider_activity_id: '222' },
  ],
  error: null,
})
jest.mock('@/lib/database/supabase-server', () => ({
  createServiceClient: () => ({ rpc, from: () => ({ upsert }) }),
}))

describe('processStreamsBackfillBatch', () => {
  beforeEach(() => {
    upsert.mockClear()
    ;(recalculateUserEffortScores as jest.Mock).mockClear()
    ;(recalculateUserFatigue as jest.Mock).mockClear()
  })

  it('fetch + stocke les streams + métriques de chaque activité manquante', async () => {
    const r = await processStreamsBackfillBatch(40)
    expect(rpc).toHaveBeenCalledWith('activities_missing_streams', { p_limit: 40 })
    expect(r.processed).toBe(2)
    expect(r.stored).toBe(2)
    expect(r.rateLimited).toBe(false)
    // 2 upserts activity_streams + 2 upserts activity_metrics (D- présent)
    expect(upsert).toHaveBeenCalledTimes(4)
  })

  it('recalcule chaque utilisateur ayant reçu un stream (une fois)', async () => {
    const r = await processStreamsBackfillBatch(40)
    expect(r.recalculatedUsers).toBe(1)
    expect(recalculateUserEffortScores).toHaveBeenCalledTimes(1)
    expect(recalculateUserEffortScores).toHaveBeenCalledWith('u1')
    expect(recalculateUserFatigue).toHaveBeenCalledTimes(1)
    expect(recalculateUserFatigue).toHaveBeenCalledWith('u1')
  })
})
