// web/__tests__/lib/training/session-templates.test.ts
import { SESSION_TEMPLATES } from '@/lib/training/session-templates'
import { BUILTIN_SESSION_TYPES, isRepeatZone } from '@/types/plan'

describe('SESSION_TEMPLATES', () => {
  it('a tous les IDs uniques', () => {
    const ids = SESSION_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('utilise uniquement des types builtin', () => {
    for (const t of SESSION_TEMPLATES) {
      expect(BUILTIN_SESSION_TYPES).toContain(t.type as any)
    }
  })

  it('a des defaultIntensity ∈ [1,5]', () => {
    for (const t of SESSION_TEMPLATES) {
      expect(t.defaultIntensity).toBeGreaterThanOrEqual(1)
      expect(t.defaultIntensity).toBeLessThanOrEqual(5)
    }
  })

  it('a des defaultDuration > 0', () => {
    for (const t of SESSION_TEMPLATES) {
      expect(t.defaultDuration).toBeGreaterThan(0)
    }
  })

  it('a une structure pour toutes les séances fractionné/seuil_tempo/côtes', () => {
    const STRUCTURED = ['fractionne', 'seuil_tempo', 'cotes']
    for (const t of SESSION_TEMPLATES) {
      if (!STRUCTURED.includes(t.type)) continue
      expect(t.defaultZones).toBeDefined()
      expect(t.defaultZones!.length).toBeGreaterThan(0)
    }
  })

  it('a un warmup ≥ 20 min sur toutes les séances qui en ont un', () => {
    for (const t of SESSION_TEMPLATES) {
      const wu = t.defaultZones?.find(z => !isRepeatZone(z) && z.kind === 'warmup')
      if (!wu) continue
      if (!isRepeatZone(wu)) {
        expect(wu.durationMin).toBeGreaterThanOrEqual(20)
      }
    }
  })

  it('a un cooldown ≥ 10 min sur toutes les séances qui en ont un', () => {
    for (const t of SESSION_TEMPLATES) {
      const cd = t.defaultZones?.find(z => !isRepeatZone(z) && z.kind === 'cooldown')
      if (!cd) continue
      if (!isRepeatZone(cd)) {
        expect(cd.durationMin).toBeGreaterThanOrEqual(10)
      }
    }
  })

  it('a aucun defaultZones sur renfo/musculation', () => {
    for (const t of SESSION_TEMPLATES) {
      if (t.type === 'renfo' || t.type === 'musculation') {
        expect(t.defaultZones).toBeUndefined()
      }
    }
  })

  it('a des RepeatZone bien formés (repeats ≥ 2, ≥ 1 step, mode/distance/durée cohérents)', () => {
    for (const t of SESSION_TEMPLATES) {
      for (const z of t.defaultZones ?? []) {
        if (!isRepeatZone(z)) continue
        expect(z.repeats).toBeGreaterThanOrEqual(2)
        expect(z.steps.length).toBeGreaterThanOrEqual(1)
        for (const step of z.steps) {
          if (step.mode === 'duration') {
            expect(step.durationMin).toBeDefined()
          } else if (step.mode === 'distance') {
            expect(step.distanceM).toBeDefined()
          }
          if (step.intensityMode === 'level') {
            expect(step.intensity).toBeDefined()
          } else if (step.intensityMode === 'pace') {
            expect(step.paceSecPerKm).toBeDefined()
          }
        }
      }
    }
  })

  it('couvre les 12 types builtin', () => {
    const typesPresent = new Set(SESSION_TEMPLATES.map(t => t.type))
    for (const builtin of BUILTIN_SESSION_TYPES) {
      expect(typesPresent.has(builtin)).toBe(true)
    }
  })
})
