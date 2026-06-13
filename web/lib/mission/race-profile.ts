// Profil de la course objectif → leviers d'adaptation des séances. Pur.
import type { Race, SessionType } from '@/types/plan'

export type Relief = 'flat' | 'rolling' | 'mountain'
export type DistanceClass = 'short' | 'mid' | 'long' | 'ultra'

export type RaceProfile = {
  relief: Relief
  distanceClass: DistanceClass
  dPlusPerKm: number               // relief réel borné [0,80]
  goalPaceMinPerKm: number | null  // targetDurationMin / distance
  qualityKinds: SessionType[]      // types de qualité privilégiés (ordre = priorité)
  longRunMaxMin: number            // plafond durée sortie longue
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const LONG_MAX: Record<DistanceClass, number> = { short: 90, mid: 150, long: 210, ultra: 240 }

const NEUTRAL: RaceProfile = {
  relief: 'flat', distanceClass: 'mid', dPlusPerKm: 20, goalPaceMinPerKm: null,
  qualityKinds: ['seuil_tempo'], longRunMaxMin: 120,
}

function qualityKindsFor(relief: Relief, distanceClass: DistanceClass): SessionType[] {
  if (relief === 'mountain') return ['cotes', 'seuil_tempo']
  if (relief === 'rolling') return ['seuil_tempo', 'cotes']
  return distanceClass === 'short' ? ['fractionne', 'seuil_tempo'] : ['seuil_tempo', 'fractionne']
}

export function raceProfile(race: Race | null): RaceProfile {
  if (!race || !race.distance) return NEUTRAL
  const ratio = race.elevation / Math.max(1, race.distance)
  let relief: Relief = ratio < 15 ? 'flat' : ratio < 35 ? 'rolling' : 'mountain'
  if (race.type === 'skyrace' && relief !== 'mountain') relief = 'mountain'
  if (race.type === 'ultra' && relief === 'flat') relief = 'rolling'
  let distanceClass: DistanceClass =
    race.distance <= 15 ? 'short' : race.distance <= 42 ? 'mid' : race.distance <= 80 ? 'long' : 'ultra'
  if (race.type === 'ultra' && (distanceClass === 'short' || distanceClass === 'mid')) distanceClass = 'long'
  const goalPaceMinPerKm = race.targetDurationMin && race.targetDurationMin > 0
    ? race.targetDurationMin / race.distance
    : null
  return {
    relief, distanceClass,
    dPlusPerKm: clamp(Math.round(ratio), 0, 80),
    goalPaceMinPerKm,
    qualityKinds: qualityKindsFor(relief, distanceClass),
    longRunMaxMin: LONG_MAX[distanceClass],
  }
}
