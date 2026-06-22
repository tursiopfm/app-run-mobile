import { findActiveOverlaps } from '@/lib/plan/overlap'
import type { TrainingPlan } from '@/types/plan'

function makePlan(overrides: Partial<TrainingPlan>): TrainingPlan {
  return {
    id: 'plan-x',
    athleteId: 'athlete-1',
    name: 'Macro X',
    goalRaceId: null,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    phases: [],
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('findActiveOverlaps', () => {
  it('signale un cycle imbriqué dans le candidat (cas Franck)', () => {
    const candidate = makePlan({ id: 'detail', startDate: '2026-05-10', endDate: '2026-08-30' })
    const nested = makePlan({ id: 'affutage', startDate: '2026-06-19', endDate: '2026-06-26' })
    expect(findActiveOverlaps(candidate, [candidate, nested]).map(p => p.id)).toEqual(['affutage'])
  })

  it('signale un recouvrement partiel', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-07-01' })
    const other = makePlan({ id: 'b', startDate: '2026-06-15', endDate: '2026-09-01' })
    expect(findActiveOverlaps(candidate, [other]).map(p => p.id)).toEqual(['b'])
  })

  it('ne signale PAS deux cycles bout-à-bout (frontière partagée)', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-06-28' })
    const other = makePlan({ id: 'b', startDate: '2026-06-28', endDate: '2026-08-01' })
    expect(findActiveOverlaps(candidate, [other])).toEqual([])
  })

  it('exclut les cycles archived', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-07-01' })
    const arch = makePlan({ id: 'arch', startDate: '2026-05-15', endDate: '2026-06-15', status: 'archived' })
    expect(findActiveOverlaps(candidate, [arch])).toEqual([])
  })

  it('exclut le candidat lui-même (cas édition)', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-07-01' })
    expect(findActiveOverlaps(candidate, [candidate])).toEqual([])
  })

  it('inclut un cycle completed (toujours visible donc masquant)', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-07-01' })
    const done = makePlan({ id: 'done', startDate: '2026-06-01', endDate: '2026-06-20', status: 'completed' })
    expect(findActiveOverlaps(candidate, [done]).map(p => p.id)).toEqual(['done'])
  })

  it('retourne tous les conflits multiples', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-01-01', endDate: '2026-12-31' })
    const b = makePlan({ id: 'b', startDate: '2026-03-01', endDate: '2026-04-01' })
    const c = makePlan({ id: 'c', startDate: '2026-09-01', endDate: '2026-10-01' })
    expect(findActiveOverlaps(candidate, [candidate, b, c]).map(p => p.id)).toEqual(['b', 'c'])
  })

  it('retourne [] quand aucun conflit', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-07-01' })
    const far = makePlan({ id: 'far', startDate: '2026-10-01', endDate: '2026-11-01' })
    expect(findActiveOverlaps(candidate, [far])).toEqual([])
  })
})
