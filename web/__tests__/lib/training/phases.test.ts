import { autoDistributePhases, PHASE_DEFINITIONS } from '@/lib/training/phases'
import type { Phase } from '@/types/plan'

function weeksOf(p: Phase): number {
  const start = new Date(p.startDate).getTime()
  const end = new Date(p.endDate).getTime()
  return Math.round((end - start) / (7 * 86_400_000))
}

function totalWeeks(phases: Phase[]): number {
  return phases.reduce((sum, p) => sum + weeksOf(p), 0)
}

describe('autoDistributePhases — prépa nominale 16 semaines', () => {
  const start = '2026-01-05'
  // +16 weeks = 2026-04-27
  const race = '2026-04-27'
  let phases: Phase[]

  beforeAll(() => {
    phases = autoDistributePhases(start, race)
  })

  it('crée les 4 phases nominales (foncier / dvp / spécifique / affûtage)', () => {
    expect(phases.length).toBe(4)
    expect(phases.map(p => p.type)).toEqual([
      'foncier',
      'developpement',
      'specifique',
      'affutage',
    ])
  })

  it('couvre exactement les 16 semaines', () => {
    expect(totalWeeks(phases)).toBe(16)
  })

  it('respecte les invariants minimaux (Affûtage ≥ 2, Spécifique ≥ 3)', () => {
    const affutage = phases.find(p => p.type === 'affutage')!
    const specifique = phases.find(p => p.type === 'specifique')!
    expect(weeksOf(affutage)).toBeGreaterThanOrEqual(2)
    expect(weeksOf(specifique)).toBeGreaterThanOrEqual(3)
  })

  it('utilise les ratios par défaut (approximatif à ±1 semaine)', () => {
    const foncier = phases.find(p => p.type === 'foncier')!
    const dvp = phases.find(p => p.type === 'developpement')!
    const expectedFoncier = Math.round(16 * PHASE_DEFINITIONS.foncier.defaultRatio)
    const expectedDvp = Math.round(16 * PHASE_DEFINITIONS.developpement.defaultRatio)
    expect(Math.abs(weeksOf(foncier) - expectedFoncier)).toBeLessThanOrEqual(2)
    expect(Math.abs(weeksOf(dvp) - expectedDvp)).toBeLessThanOrEqual(2)
  })

  it('génère un id UUID-like pour chaque phase', () => {
    const ids = new Set(phases.map(p => p.id))
    expect(ids.size).toBe(phases.length)
    phases.forEach(p => expect(p.id.length).toBeGreaterThan(8))
  })
})

describe('autoDistributePhases — prépa courte (6 semaines)', () => {
  let phases: Phase[]
  let warnSpy: jest.SpyInstance

  beforeAll(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    // 2026-01-05 → +6 semaines → 2026-02-16
    phases = autoDistributePhases('2026-01-05', '2026-02-16')
  })

  afterAll(() => {
    warnSpy.mockRestore()
  })

  it('émet le warning console "Prépa courte"', () => {
    expect(warnSpy).toHaveBeenCalled()
    const msg = warnSpy.mock.calls.flat().join(' ')
    expect(msg).toMatch(/Prépa courte/i)
  })

  it("n'inclut pas de phase Foncier", () => {
    expect(phases.some(p => p.type === 'foncier')).toBe(false)
  })

  it('contient Affûtage 2 sem + Spécifique 3 sem + Développement 1 sem', () => {
    expect(phases.map(p => p.type)).toEqual(['developpement', 'specifique', 'affutage'])
    const dvp = phases.find(p => p.type === 'developpement')!
    const spe = phases.find(p => p.type === 'specifique')!
    const aff = phases.find(p => p.type === 'affutage')!
    expect(weeksOf(dvp)).toBe(1)
    expect(weeksOf(spe)).toBe(3)
    expect(weeksOf(aff)).toBe(2)
  })
})

describe('autoDistributePhases — prépa longue (24 semaines)', () => {
  let phases: Phase[]

  beforeAll(() => {
    // 2026-01-05 → +24 semaines → 2026-06-22
    phases = autoDistributePhases('2026-01-05', '2026-06-22')
  })

  it('contient deux blocs Foncier + une récup intermédiaire', () => {
    const types = phases.map(p => p.type)
    const foncierCount = types.filter(t => t === 'foncier').length
    const recupCount = types.filter(t => t === 'recuperation').length
    expect(foncierCount).toBe(2)
    expect(recupCount).toBe(1)
  })

  it('place les blocs dans l\'ordre Foncier 1 → Récup → Foncier 2 → Développement → Spécifique → Affûtage', () => {
    expect(phases.map(p => p.type)).toEqual([
      'foncier',
      'recuperation',
      'foncier',
      'developpement',
      'specifique',
      'affutage',
    ])
    expect(phases[0].label).toMatch(/Foncier 1/i)
    expect(phases[2].label).toMatch(/Foncier 2/i)
  })

  it('couvre les 24 semaines totales', () => {
    expect(totalWeeks(phases)).toBe(24)
  })

  it('la récup intermédiaire dure 1 semaine', () => {
    const recup = phases.find(p => p.type === 'recuperation')!
    expect(weeksOf(recup)).toBe(1)
  })
})

describe('autoDistributePhases — dates invalides', () => {
  it('retourne [] si raceDate < startDate', () => {
    expect(autoDistributePhases('2026-04-01', '2026-01-01')).toEqual([])
  })

  it('retourne [] si dates identiques', () => {
    expect(autoDistributePhases('2026-04-01', '2026-04-01')).toEqual([])
  })
})
