import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

export type PolarActivity = Record<string, unknown>

export function polarToNormalized(_userId: string, _a: PolarActivity): NormalizedActivity {
  throw new Error('Polar provider not yet implemented')
}
