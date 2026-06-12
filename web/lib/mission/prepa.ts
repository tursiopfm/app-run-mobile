// Bloc « Ma prépa » du Mode Mission : anneau % séances faites + frise de phases.

import { isRaceMirrorSession } from '@/lib/plan/storage'
import type { PlannedSession, TrainingPlan } from '@/types/plan'

const MS_DAY = 86_400_000

export type PrepaProgress = { done: number; total: number; pct: number }

export function computePrepaProgress(sessions: PlannedSession[]): PrepaProgress {
  const real = sessions.filter(s => !isRaceMirrorSession(s))
  const done = real.filter(s => s.status === 'completed').length
  const total = real.length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export type PhaseSegment = {
  label: string
  widthPct: number
  active: boolean
  cursorPct: number | null   // position du jour dans la phase active, sinon null
}

function days(fromISO: string, toISO: string): number {
  return Math.max(1, Math.round(
    (new Date(`${toISO}T00:00:00Z`).getTime() - new Date(`${fromISO}T00:00:00Z`).getTime()) / MS_DAY,
  ) + 1)
}

export function computePhaseSegments(plan: TrainingPlan, todayISO: string): PhaseSegment[] {
  const totalDays = plan.phases.reduce((s, p) => s + days(p.startDate, p.endDate), 0)
  if (totalDays === 0) return []
  return plan.phases.map(p => {
    const active = p.startDate <= todayISO && todayISO <= p.endDate
    const phaseDays = days(p.startDate, p.endDate)
    return {
      label: p.label,
      widthPct: (phaseDays / totalDays) * 100,
      active,
      cursorPct: active
        ? Math.min(100, Math.max(0, ((days(p.startDate, todayISO) - 1) / phaseDays) * 100))
        : null,
    }
  })
}

export function weekOfPlan(plan: TrainingPlan, todayISO: string): { week: number; total: number } {
  const start = new Date(`${plan.startDate}T00:00:00Z`).getTime()
  const end = new Date(`${plan.endDate}T00:00:00Z`).getTime()
  const today = new Date(`${todayISO}T00:00:00Z`).getTime()
  const total = Math.max(1, Math.ceil((end - start + MS_DAY) / (7 * MS_DAY)))
  const week = Math.min(total, Math.max(1, Math.floor((today - start) / (7 * MS_DAY)) + 1))
  return { week, total }
}
