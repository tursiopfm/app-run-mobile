import { getValidStravaToken } from './token'
import { fetchStravaActivities } from './api'
import { stravaToNormalized } from './mapper'
import { createClient } from '@/lib/database/supabase-server'
import type { ProviderSyncer, SyncOptions } from '@/lib/sync/types'
import type { NormalizedActivity } from './mapper'

export const stravaSyncer: ProviderSyncer = {
  provider: 'strava',

  async fetchActivities(userId: string, options?: SyncOptions): Promise<NormalizedActivity[]> {
    const accessToken = await getValidStravaToken(userId)

    let after: number | undefined
    if (!options?.fullSync) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('activities')
        .select('start_time')
        .eq('user_id', userId)
        .eq('provider', 'strava')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        after = Math.floor(new Date(data.start_time as string).getTime() / 1000)
      }
    }

    const stravaActivities = await fetchStravaActivities(accessToken, { after })
    return stravaActivities.map((a) => stravaToNormalized(userId, a))
  },
}
