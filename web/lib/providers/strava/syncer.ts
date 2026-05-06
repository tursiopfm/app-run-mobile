import { getValidStravaToken } from './token'
import { fetchStravaActivities } from './api'
import { stravaToNormalized } from './mapper'
import type { ProviderSyncer, SyncOptions } from '@/lib/sync/types'
import type { NormalizedActivity } from './mapper'

export const INCREMENTAL_WINDOW_DAYS = 30

export const stravaSyncer: ProviderSyncer = {
  provider: 'strava',

  async fetchActivities(userId: string, options?: SyncOptions): Promise<NormalizedActivity[]> {
    const accessToken = await getValidStravaToken(userId)

    // Incremental: re-fetch a sliding window so renames + deletes propagate.
    // (Previous "after max(start_time)" missed renames of older activities.)
    const after = options?.fullSync
      ? undefined
      : Math.floor((Date.now() - INCREMENTAL_WINDOW_DAYS * 86_400_000) / 1000)

    const stravaActivities = await fetchStravaActivities(accessToken, {
      after,
      maxActivities: options?.fullSync ? 1000 : 200,
    })
    return stravaActivities.map((a) => stravaToNormalized(userId, a))
  },
}
