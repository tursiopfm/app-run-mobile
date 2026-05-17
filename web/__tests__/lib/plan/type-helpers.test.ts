import { isRunningType, getDefaultIntensityMode } from '@/lib/plan/type-helpers'

describe('isRunningType', () => {
  it.each(['course', 'sortie_longue', 'fractionne', 'seuil_tempo', 'cotes', 'footing', 'runtaf'])(
    'returns true for running type %s',
    (type) => {
      expect(isRunningType(type as never)).toBe(true)
    },
  )

  it.each(['velo', 'velotaf', 'natation', 'renfo', 'musculation'])(
    'returns false for non-running type %s',
    (type) => {
      expect(isRunningType(type as never)).toBe(false)
    },
  )

  it('returns false for unknown custom type', () => {
    expect(isRunningType('tennis' as never)).toBe(false)
  })
})

describe('getDefaultIntensityMode', () => {
  it('returns pace for running types', () => {
    expect(getDefaultIntensityMode('fractionne')).toBe('pace')
    expect(getDefaultIntensityMode('footing')).toBe('pace')
  })

  it('returns level for non-running types', () => {
    expect(getDefaultIntensityMode('velo')).toBe('level')
    expect(getDefaultIntensityMode('renfo')).toBe('level')
  })
})
