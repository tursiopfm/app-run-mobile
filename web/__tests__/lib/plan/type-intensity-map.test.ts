import { TYPE_DEFAULT_INTENSITY, getDefaultIntensityForType } from '@/lib/plan/type-intensity-map'

describe('TYPE_DEFAULT_INTENSITY', () => {
  it('maps fractionne to 5 (VMA)', () => {
    expect(TYPE_DEFAULT_INTENSITY.fractionne).toBe(5)
  })

  it('maps seuil_tempo to 4 (Seuil)', () => {
    expect(TYPE_DEFAULT_INTENSITY.seuil_tempo).toBe(4)
  })

  it('maps cotes to 3 (Tempo)', () => {
    expect(TYPE_DEFAULT_INTENSITY.cotes).toBe(3)
  })

  it('maps footing/sortie_longue/course/runtaf/velotaf/velo/natation to 2 (Endurance)', () => {
    expect(TYPE_DEFAULT_INTENSITY.footing).toBe(2)
    expect(TYPE_DEFAULT_INTENSITY.sortie_longue).toBe(2)
    expect(TYPE_DEFAULT_INTENSITY.course).toBe(2)
    expect(TYPE_DEFAULT_INTENSITY.runtaf).toBe(2)
    expect(TYPE_DEFAULT_INTENSITY.velotaf).toBe(2)
    expect(TYPE_DEFAULT_INTENSITY.velo).toBe(2)
    expect(TYPE_DEFAULT_INTENSITY.natation).toBe(2)
  })

  it('maps renfo/musculation to 1 (Récup)', () => {
    expect(TYPE_DEFAULT_INTENSITY.renfo).toBe(1)
    expect(TYPE_DEFAULT_INTENSITY.musculation).toBe(1)
  })
})

describe('getDefaultIntensityForType', () => {
  it('returns the mapping for a known type', () => {
    expect(getDefaultIntensityForType('fractionne')).toBe(5)
  })

  it('falls back to 2 (Endurance) for an unknown custom type', () => {
    expect(getDefaultIntensityForType('tennis' as never)).toBe(2)
  })
})
