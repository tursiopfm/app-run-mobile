import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

export type GarminActivity = Record<string, unknown>

export function garminToNormalized(_userId: string, _a: GarminActivity): NormalizedActivity {
  throw new Error('Garmin provider not yet implemented')
}
