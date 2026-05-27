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

  it('a une RepeatZone sur toutes les séances fractionné et côtes', () => {
    // fractionné et côtes DOIVENT contenir au moins un container Répéter
    // (seuil_tempo peut être un tempo continu sans RepeatZone, donc exclu ici).
    const NEEDS_REPEAT = ['fractionne', 'cotes']
    for (const t of SESSION_TEMPLATES) {
      if (!NEEDS_REPEAT.includes(t.type)) continue
      if (!t.defaultZones) continue // déjà couvert par le test précédent
      const hasRepeat = t.defaultZones.some(z => isRepeatZone(z))
      // Exception : les sorties bosses (co-bosses-natu, co-bosses-2h) sont du
      // type 'cotes' mais sans RepeatZone (parcours libre). On accepte donc
      // un fallback "au moins 1 main" pour ces cas.
      const hasMain = t.defaultZones.some(z => !isRepeatZone(z) && z.kind === 'main')
      expect(hasRepeat || hasMain).toBe(true)
      // Pour les vraies séries (fractionné toujours), on exige RepeatZone :
      if (t.type === 'fractionne') {
        expect(hasRepeat).toBe(true)
      }
    }
  })

  it('a un warmup ≥ 20 min sur toutes les séances structurées (fractionné/seuil_tempo/côtes) qui ont une RepeatZone', () => {
    // Pour les séances avec RepeatZone, un warmup est obligatoire et doit être ≥ 20 min.
    // Les sorties libres (sorties bosses, tempo continu) sans RepeatZone n'en exigent pas.
    const STRUCTURED = ['fractionne', 'seuil_tempo', 'cotes']
    for (const t of SESSION_TEMPLATES) {
      if (!STRUCTURED.includes(t.type)) continue
      if (!t.defaultZones) continue
      const hasRepeat = t.defaultZones.some(z => isRepeatZone(z))
      if (!hasRepeat) continue
      const wu = t.defaultZones.find(z => !isRepeatZone(z) && z.kind === 'warmup')
      expect(wu).toBeDefined()
      if (wu && !isRepeatZone(wu)) {
        expect(wu.durationMin).toBeGreaterThanOrEqual(20)
      }
    }
  })

  it('a un cooldown ≥ 10 min sur toutes les séances structurées avec RepeatZone', () => {
    const STRUCTURED = ['fractionne', 'seuil_tempo', 'cotes']
    for (const t of SESSION_TEMPLATES) {
      if (!STRUCTURED.includes(t.type)) continue
      if (!t.defaultZones) continue
      const hasRepeat = t.defaultZones.some(z => isRepeatZone(z))
      if (!hasRepeat) continue
      const cd = t.defaultZones.find(z => !isRepeatZone(z) && z.kind === 'cooldown')
      expect(cd).toBeDefined()
      if (cd && !isRepeatZone(cd)) {
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

  it('couvre tous les types builtin', () => {
    const typesPresent = new Set(SESSION_TEMPLATES.map(t => t.type))
    for (const builtin of BUILTIN_SESSION_TYPES) {
      expect(typesPresent.has(builtin)).toBe(true)
    }
  })
})
