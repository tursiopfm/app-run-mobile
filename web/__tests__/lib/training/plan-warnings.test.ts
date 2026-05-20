import { computeWarnings, type PlanWarning } from '@/lib/training/plan-warnings'
import type { MesocycleWeek, Phase, Race, TrainingPlan } from '@/types/plan'

function makePlan(o: Partial<TrainingPlan>): TrainingPlan {
  return {
    id: 'plan-1',
    athleteId: 'a1',
    name: 'Plan',
    goalRaceId: null,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    phases: [],
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...o,
  }
}

function makePhase(o: Partial<Phase>): Phase {
  return {
    id: 'p1',
    type: 'foncier',
    label: 'Foncier',
    startDate: '2026-04-01',
    endDate: '2026-04-29',
    weeklyChargeTarget: 400,
    weeklyDistanceKmTarget: 60,
    weeklyElevationMTarget: 1200,
    loadPattern: 'custom',
    ...o,
  }
}

function makeRace(o: Partial<Race>): Race {
  return {
    id: 'r1',
    name: 'Race',
    date: '2026-06-15',
    distance: 42,
    elevation: 1500,
    type: 'trail',
    isMain: false,
    priority: 'C',
    ...o,
  }
}

function makeWeek(o: Partial<MesocycleWeek>): MesocycleWeek {
  return {
    id: 'w1',
    phaseId: 'p1',
    weekIndex: 0,
    weekStartDate: '2026-04-01',
    weekType: 'load',
    targetLoadTss: 400,
    targetVolumeKm: 50,
    targetDplusM: 1000,
    isManualOverride: false,
    generatedFromPattern: true,
    ...o,
  }
}

describe('computeWarnings', () => {
  it('1. empty input → []', () => {
    expect(computeWarnings({ macros: [], activeMacrocycle: null, races: [], weeksByPhase: {} })).toEqual([])
  })

  it('2. race A dans la fenêtre macro → pas de race_a_orphan', () => {
    const macro = makePlan({ startDate: '2026-01-01', endDate: '2026-12-31' })
    const race = makeRace({ priority: 'A', date: '2026-06-15' })
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races: [race], weeksByPhase: {} })
    expect(out.some(w => w.kind === 'race_a_orphan')).toBe(false)
  })

  it('3. race A hors macro → 1 race_a_orphan critical', () => {
    const macro = makePlan({ startDate: '2026-01-01', endDate: '2026-05-31' })
    const race = makeRace({ id: 'utmb', name: 'UTMB', priority: 'A', date: '2026-08-30' })
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races: [race], weeksByPhase: {} })
    const orphans = out.filter(w => w.kind === 'race_a_orphan')
    expect(orphans).toHaveLength(1)
    expect(orphans[0].severity).toBe('critical')
    expect(orphans[0].raceId).toBe('utmb')
  })

  it('4. race A avec phase affutage J-3 → pas de taper_missing', () => {
    const race = makeRace({ id: 'utmb', priority: 'A', date: '2026-08-30' })
    const tap = makePhase({ id: 'tap', type: 'affutage', startDate: '2026-08-15', endDate: '2026-08-27' })
    const macro = makePlan({ startDate: '2026-04-01', endDate: '2026-09-15', phases: [tap], goalRaceId: 'utmb' })
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races: [race], weeksByPhase: {} })
    expect(out.some(w => w.kind === 'taper_missing')).toBe(false)
  })

  it('5. race A sans phase affutage → 1 taper_missing warning', () => {
    const race = makeRace({ id: 'utmb', priority: 'A', date: '2026-08-30' })
    const p1 = makePhase({ id: 'p1', type: 'foncier', startDate: '2026-04-01', endDate: '2026-08-25' })
    const macro = makePlan({ startDate: '2026-04-01', endDate: '2026-09-15', phases: [p1], goalRaceId: 'utmb' })
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races: [race], weeksByPhase: {} })
    const taper = out.filter(w => w.kind === 'taper_missing')
    expect(taper).toHaveLength(1)
    expect(taper[0].severity).toBe('warning')
  })

  it('6. race A avec affutage J-20 (hors fenêtre 14j) → taper_missing quand même', () => {
    const race = makeRace({ id: 'utmb', priority: 'A', date: '2026-08-30' })
    const tap = makePhase({ id: 'tap', type: 'affutage', startDate: '2026-07-25', endDate: '2026-08-10' })
    const macro = makePlan({ startDate: '2026-04-01', endDate: '2026-09-15', phases: [tap], goalRaceId: 'utmb' })
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races: [race], weeksByPhase: {} })
    expect(out.some(w => w.kind === 'taper_missing')).toBe(true)
  })

  it('7. sem N+1 volume = sem N × 1.25 → 1 sharp_ramp', () => {
    const phase = makePhase({ id: 'p1' })
    const macro = makePlan({ phases: [phase] })
    const weeks = [
      makeWeek({ id: 'w0', weekIndex: 0, targetVolumeKm: 50 }),
      makeWeek({ id: 'w1', weekIndex: 1, targetVolumeKm: 63 }),  // +26%
    ]
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races: [], weeksByPhase: { p1: weeks } })
    const ramps = out.filter(w => w.kind === 'sharp_ramp')
    expect(ramps.length).toBeGreaterThanOrEqual(1)
    expect(ramps[0].weekIndex).toBe(1)
  })

  it('8. sem N+1 volume = sem N × 1.10 → pas de sharp_ramp', () => {
    const phase = makePhase({ id: 'p1' })
    const macro = makePlan({ phases: [phase] })
    const weeks = [
      makeWeek({ id: 'w0', weekIndex: 0, targetVolumeKm: 50, targetLoadTss: 400, targetDplusM: 1000 }),
      makeWeek({ id: 'w1', weekIndex: 1, targetVolumeKm: 55, targetLoadTss: 440, targetDplusM: 1100 }),
    ]
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races: [], weeksByPhase: { p1: weeks } })
    expect(out.filter(w => w.kind === 'sharp_ramp')).toEqual([])
  })

  it('9. 2 phases avec gap → 1 phase_gap', () => {
    const p1 = makePhase({ id: 'a', startDate: '2026-04-01', endDate: '2026-06-01' })
    const p2 = makePhase({ id: 'b', startDate: '2026-06-05', endDate: '2026-08-01' })
    const macro = makePlan({ phases: [p1, p2] })
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races: [], weeksByPhase: {} })
    expect(out.filter(w => w.kind === 'phase_gap')).toHaveLength(1)
  })

  it('10. 2 phases qui se touchent (p1.end = p2.start) → pas de warning', () => {
    const p1 = makePhase({ id: 'a', startDate: '2026-04-01', endDate: '2026-06-01' })
    const p2 = makePhase({ id: 'b', startDate: '2026-06-01', endDate: '2026-08-01' })
    const macro = makePlan({ phases: [p1, p2] })
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races: [], weeksByPhase: {} })
    expect(out.filter(w => w.kind === 'phase_gap' || w.kind === 'phase_overlap')).toEqual([])
  })

  it('11. 2 phases qui se chevauchent → 1 phase_overlap', () => {
    const p1 = makePhase({ id: 'a', startDate: '2026-04-01', endDate: '2026-06-10' })
    const p2 = makePhase({ id: 'b', startDate: '2026-06-01', endDate: '2026-08-01' })
    const macro = makePlan({ phases: [p1, p2] })
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races: [], weeksByPhase: {} })
    expect(out.filter(w => w.kind === 'phase_overlap')).toHaveLength(1)
  })

  it('12. race B/C → aucun warning race_a_orphan ni taper_missing', () => {
    const macro = makePlan({ startDate: '2026-01-01', endDate: '2026-05-31' })
    const races = [
      makeRace({ id: 'b1', priority: 'B', date: '2026-08-30' }),
      makeRace({ id: 'c1', priority: 'C', date: '2026-04-15' }),
    ]
    const out = computeWarnings({ macros: [macro], activeMacrocycle: macro, races, weeksByPhase: {} })
    expect(out.filter(w => w.kind === 'race_a_orphan' || w.kind === 'taper_missing')).toEqual([])
  })
})
