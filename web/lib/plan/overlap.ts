// Détection pure des chevauchements de macrocycles (sans I/O).
// « Actif » = status !== 'archived' (cohérent avec pickActiveMacrocycle).
// Chevauchement STRICT : deux cycles bout-à-bout partageant un seul jour-frontière
// ne sont pas en conflit ; un cycle imbriqué ou un recouvrement le sont.

import type { TrainingPlan } from '@/types/plan'

export function findActiveOverlaps(
  candidate: TrainingPlan,
  all: TrainingPlan[],
): TrainingPlan[] {
  return all.filter(
    (other) =>
      other.id !== candidate.id &&
      other.status !== 'archived' &&
      candidate.startDate < other.endDate &&
      other.startDate < candidate.endDate,
  )
}
