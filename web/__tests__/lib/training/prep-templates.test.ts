import { applyTemplate, PREP_TEMPLATES } from '@/lib/training/prep-templates'
import { phaseWeekCount } from '@/lib/training/phases'

const ULTRA_START = '2026-04-01'
const ULTRA_END_21W = '2026-08-26'    // ~21 semaines (147 jours)
const ULTRA_END_14W = '2026-07-08'    // ~14 semaines (98 jours)
const REPRISE_END_4W = '2026-04-29'   // ~4 semaines (28 jours)

describe('PREP_TEMPLATES', () => {
  it('expose 4 templates : ultra, trail_court, reprise, custom', () => {
    expect(Object.keys(PREP_TEMPLATES).sort()).toEqual(['custom', 'reprise', 'trail_court', 'ultra'].sort())
  })

  it('chaque template (sauf custom) a nominalWeeks = somme des recipes', () => {
    for (const tpl of Object.values(PREP_TEMPLATES)) {
      if (tpl.recipes.length === 0) continue
      const sum = tpl.recipes.reduce((acc, r) => acc + r.weeks, 0)
      expect(tpl.nominalWeeks).toBe(sum)
    }
  })
})

describe('applyTemplate', () => {
  it('1. custom → phases vides, compressed=false', () => {
    const r = applyTemplate('custom', ULTRA_START, ULTRA_END_21W)
    expect(r.phases).toEqual([])
    expect(r.meta.compressed).toBe(false)
  })

  it('2. ultra avec 21 sem dispo → 5 phases [6,5,6,2,2], non compressed', () => {
    const r = applyTemplate('ultra', ULTRA_START, ULTRA_END_21W)
    expect(r.phases).toHaveLength(5)
    expect(r.meta.compressed).toBe(false)
    expect(r.phases.map(p => phaseWeekCount(p))).toEqual([6, 5, 6, 2, 2])
  })

  it('3. ultra avec 14 sem dispo → 5 phases, total proche de 14, compressed=true', () => {
    const r = applyTemplate('ultra', ULTRA_START, ULTRA_END_14W)
    expect(r.phases).toHaveLength(5)
    expect(r.meta.compressed).toBe(true)
    const total = r.phases.reduce((acc, p) => acc + phaseWeekCount(p), 0)
    expect(total).toBe(14)  // les arrondis cumulés sont ajustés par la dernière phase
  })

  it('4. compression : recipe weeks=1 ne tombe pas à 0 (min 1)', () => {
    // trail_court a une phase "Taper" de 1 sem. Disponible 5 sem (très court) → forcer compression.
    const r = applyTemplate('trail_court', '2026-04-01', '2026-05-06')  // 5 sem
    const taperPhase = r.phases[r.phases.length - 1]
    expect(phaseWeekCount(taperPhase)).toBeGreaterThanOrEqual(1)
  })

  it("5. dernière phase ajustée pour endDate === macroEnd exactement", () => {
    const r = applyTemplate('ultra', ULTRA_START, ULTRA_END_14W)
    const last = r.phases[r.phases.length - 1]
    expect(last.endDate).toBe(ULTRA_END_14W)
  })

  it('6. reprise avec 4 sem dispo (< minWeeks=6) → génère quand même + compressed=true', () => {
    const r = applyTemplate('reprise', '2026-04-01', REPRISE_END_4W)  // 4 sem
    expect(r.phases.length).toBeGreaterThan(0)
    expect(r.meta.compressed).toBe(true)
  })

  it("7. 0 jour dispo → phases vides + meta.error='too_short'", () => {
    const r = applyTemplate('ultra', '2026-04-01', '2026-04-01')  // 0 jour
    expect(r.phases).toEqual([])
    expect(r.meta.error).toBe('too_short')
  })

  it('8. ordre des phases préservé (foncier → spé → affût pour ultra)', () => {
    const r = applyTemplate('ultra', ULTRA_START, ULTRA_END_21W)
    expect(r.phases.map(p => p.type)).toEqual([
      'foncier', 'developpement', 'specifique', 'specifique', 'affutage',
    ])
  })

  it('9. loadPattern correctement assigné (foncier→progressive_3_1, affutage→taper)', () => {
    const r = applyTemplate('ultra', ULTRA_START, ULTRA_END_21W)
    expect(r.phases[0].loadPattern).toBe('progressive_3_1')   // foncier
    expect(r.phases[4].loadPattern).toBe('taper')             // affutage
  })

  it('10. focus text propagé dans la Phase générée', () => {
    const r = applyTemplate('ultra', ULTRA_START, ULTRA_END_21W)
    expect(r.phases[0].focus).toBe('Base aérobie')
    expect(r.phases[1].focus).toBe('Force / Côtes / D+')
    expect(r.phases[4].focus).toBe('Taper')
  })
})
