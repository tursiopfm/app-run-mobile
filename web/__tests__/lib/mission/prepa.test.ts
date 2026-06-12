import { computePrepaProgress, computePhaseSegments, weekOfPlan } from '@/lib/mission/prepa'
import type { PlannedSession, TrainingPlan } from '@/types/plan'

function session(p: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'x', planId: 'p', date: '2026-06-10', type: 'footing', title: 'S',
    duration: 60, intensity: 2, estimatedCharge: 50, status: 'planned', ...p,
  }
}

describe('computePrepaProgress', () => {
  it('compte faites / total en excluant les miroirs de course', () => {
    const sessions = [
      session({ id: '1', status: 'completed' }),
      session({ id: '2', status: 'completed' }),
      session({ id: '3', status: 'planned' }),
      session({ id: '4', status: 'skipped' }),
      session({ id: '5', templateId: 'race-mirror' }), // exclu
    ]
    expect(computePrepaProgress(sessions)).toEqual({ done: 2, total: 4, pct: 50 })
  })
  it('0 séance → pct 0 sans division par zéro', () => {
    expect(computePrepaProgress([])).toEqual({ done: 0, total: 0, pct: 0 })
  })
})

const plan: TrainingPlan = {
  id: 'p1', athleteId: 'a', name: 'P', goalRaceId: null,
  startDate: '2026-05-04', endDate: '2026-07-26', status: 'active',
  createdAt: '', updatedAt: '',
  phases: [
    { id: 'a1', type: 'foncier',    label: 'Base',       startDate: '2026-05-04', endDate: '2026-05-31', weeklyChargeTarget: 0, weeklyDistanceKmTarget: 0, weeklyElevationMTarget: 0 },
    { id: 'a2', type: 'specifique', label: 'Spécifique', startDate: '2026-06-01', endDate: '2026-07-12', weeklyChargeTarget: 0, weeklyDistanceKmTarget: 0, weeklyElevationMTarget: 0 },
    { id: 'a3', type: 'affutage',   label: 'Affûtage',   startDate: '2026-07-13', endDate: '2026-07-26', weeklyChargeTarget: 0, weeklyDistanceKmTarget: 0, weeklyElevationMTarget: 0 },
  ],
}

describe('computePhaseSegments', () => {
  it('largeurs proportionnelles à la durée, phase active marquée + curseur', () => {
    const segs = computePhaseSegments(plan, '2026-06-12')
    expect(segs).toHaveLength(3)
    expect(segs.map(s => s.active)).toEqual([false, true, false])
    const totalPct = segs.reduce((s, x) => s + x.widthPct, 0)
    expect(totalPct).toBeGreaterThan(99)
    expect(totalPct).toBeLessThan(101)
    // curseur dans la phase active uniquement, entre 0 et 100
    expect(segs[1].cursorPct).toBeGreaterThanOrEqual(0)
    expect(segs[1].cursorPct).toBeLessThanOrEqual(100)
    expect(segs[0].cursorPct).toBeNull()
  })
})

describe('weekOfPlan', () => {
  it('semaine X / Y (1-based)', () => {
    expect(weekOfPlan(plan, '2026-05-04')).toEqual({ week: 1, total: 12 })
    expect(weekOfPlan(plan, '2026-06-12')).toEqual({ week: 6, total: 12 })
  })
})
