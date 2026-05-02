import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

export type SuuntoActivity = Record<string, unknown>

export function suuntoToNormalized(_userId: string, _a: SuuntoActivity): NormalizedActivity {
  throw new Error('Suunto provider not yet implemented')
}
