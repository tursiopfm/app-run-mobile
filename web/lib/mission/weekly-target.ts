// Cible km/D+ de la semaine courante pour le bloc « Cap de la semaine ».
// Pure : reçoit les macrocycles (le composant les charge via getAllMacrocycles()
// ou peekMacros()) et la date du jour en ISO.

import { pickActiveMacrocycle } from '@/lib/plan/storage'
import { resolveWeeklyTarget } from '@/lib/training/phases'
import type { TrainingPlan } from '@/types/plan'

export type MissionWeeklyTarget = { km: number; dPlus: number; phaseLabel: string }

function mondayISO(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - (dow - 1))
  return d.toISOString().slice(0, 10)
}

export function resolveMissionWeeklyTarget(
  macros: TrainingPlan[],
  todayISO: string,
): MissionWeeklyTarget | null {
  const weekStart = mondayISO(todayISO)
  const plan = pickActiveMacrocycle(macros, weekStart)
  if (!plan) return null
  const phase = plan.phases.find(p => p.startDate <= weekStart && weekStart <= p.endDate)
  if (!phase) return null
  const t = resolveWeeklyTarget(phase, weekStart)
  return { km: t.km, dPlus: t.dPlus, phaseLabel: phase.label }
}

// Fraction de la semaine écoulée fin de journée incluse (lundi = 1/7 …
// dimanche = 1) → position du repère « où tu devrais en être » sur les jauges.
export function expectedWeekFraction(todayISO: string): number {
  const dow = new Date(`${todayISO}T00:00:00Z`).getUTCDay() || 7
  return dow / 7
}
