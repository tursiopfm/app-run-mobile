import { pickActiveMacrocycle } from '@/lib/plan/storage'
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

describe('pickActiveMacrocycle', () => {
  it('retourne null si aucun macrocycle', () => {
    expect(pickActiveMacrocycle([], '2026-05-20')).toBeNull()
  })

  it('retourne le macrocycle dont la fenêtre contient today', () => {
    const m1 = makePlan({ id: 'm1', startDate: '2026-01-01', endDate: '2026-04-30', status: 'completed' })
    const m2 = makePlan({ id: 'm2', startDate: '2026-05-01', endDate: '2026-08-31', status: 'active' })
    const m3 = makePlan({ id: 'm3', startDate: '2026-09-01', endDate: '2026-12-31', status: 'planned' })

    expect(pickActiveMacrocycle([m1, m2, m3], '2026-05-20')?.id).toBe('m2')
  })

  it("retourne le macrocycle futur le plus proche si today est avant tous", () => {
    const m1 = makePlan({ id: 'm1', startDate: '2026-08-01', endDate: '2026-10-31', status: 'planned' })
    const m2 = makePlan({ id: 'm2', startDate: '2026-06-01', endDate: '2026-09-30', status: 'planned' })

    expect(pickActiveMacrocycle([m1, m2], '2026-05-01')?.id).toBe('m2')
  })

  it("retourne le macrocycle passé le plus récent si today est après tous", () => {
    const m1 = makePlan({ id: 'm1', startDate: '2026-01-01', endDate: '2026-03-31', status: 'completed' })
    const m2 = makePlan({ id: 'm2', startDate: '2026-04-01', endDate: '2026-05-31', status: 'completed' })

    expect(pickActiveMacrocycle([m1, m2], '2026-08-01')?.id).toBe('m2')
  })

  it("ignore les archived sauf si rien d'autre dispo", () => {
    const archived = makePlan({ id: 'arch', startDate: '2026-05-01', endDate: '2026-08-31', status: 'archived' })
    const active = makePlan({ id: 'act', startDate: '2026-06-01', endDate: '2026-09-30', status: 'active' })

    // archived dans la fenêtre + active aussi → on prend l'active.
    expect(pickActiveMacrocycle([archived, active], '2026-06-15')?.id).toBe('act')

    // Seulement des archived → fallback sur l'archived dont end_date est le plus récent.
    const arch2 = makePlan({ id: 'arch2', startDate: '2026-01-01', endDate: '2026-04-30', status: 'archived' })
    expect(pickActiveMacrocycle([archived, arch2], '2026-12-01')?.id).toBe('arch')  // end '2026-08-31' > '2026-04-30'
  })

  it("départage 2 macros qui se chevauchent par le plus récent start_date", () => {
    const saison = makePlan({ id: 'saison', startDate: '2026-01-01', endDate: '2026-12-31', status: 'active' })
    const prepa = makePlan({ id: 'prepa', startDate: '2026-05-01', endDate: '2026-07-31', status: 'active' })

    // Today dans la fenêtre des deux → on prend prepa (start_date plus récent).
    expect(pickActiveMacrocycle([saison, prepa], '2026-06-15')?.id).toBe('prepa')
  })
})
