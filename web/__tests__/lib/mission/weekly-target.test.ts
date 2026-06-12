import { resolveMissionWeeklyTarget, expectedWeekFraction } from '@/lib/mission/weekly-target'
import type { TrainingPlan } from '@/types/plan'

function makePlan(): TrainingPlan {
  return {
    id: 'p1', athleteId: 'a1', name: 'Prépa test', goalRaceId: null,
    startDate: '2026-06-01', endDate: '2026-08-30', status: 'active',
    createdAt: '', updatedAt: '',
    phases: [{
      id: 'ph1', type: 'specifique', label: 'Spécifique',
      startDate: '2026-06-01', endDate: '2026-07-12',
      weeklyChargeTarget: 400, weeklyDistanceKmTarget: 50, weeklyElevationMTarget: 2000,
    }],
  }
}

describe('resolveMissionWeeklyTarget', () => {
  it('renvoie la cible de la phase couvrant la semaine courante', () => {
    // 2026-06-12 est un vendredi → lundi de la semaine = 2026-06-08
    expect(resolveMissionWeeklyTarget([makePlan()], '2026-06-12'))
      .toEqual({ km: 50, dPlus: 2000, phaseLabel: 'Spécifique' })
  })
  it('null si aucun plan actif ne couvre la date', () => {
    expect(resolveMissionWeeklyTarget([makePlan()], '2026-12-25')).toBeNull()
    expect(resolveMissionWeeklyTarget([], '2026-06-12')).toBeNull()
  })
})

describe('expectedWeekFraction', () => {
  it('lundi → 1/7, dimanche → 7/7', () => {
    expect(expectedWeekFraction('2026-06-08')).toBeCloseTo(1 / 7) // lundi
    expect(expectedWeekFraction('2026-06-14')).toBeCloseTo(1)     // dimanche
  })
})
