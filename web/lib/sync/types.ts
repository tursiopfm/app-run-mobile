import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

export type SyncOptions = {
  fullSync?: boolean
}

export type ProviderSyncer = {
  provider: string
  fetchActivities(userId: string, options?: SyncOptions): Promise<NormalizedActivity[]>
}
