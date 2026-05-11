import { HR_METHODS, getMethodMeta, requiredFieldsFor } from '@/lib/health/hr-method-meta'

describe('HR_METHODS', () => {
  it('a 7 méthodes', () => {
    expect(HR_METHODS).toHaveLength(7)
  })

  it('chaque méthode a un libellé, une description, un badge et une couleur', () => {
    for (const m of HR_METHODS) {
      expect(m.label).toBeTruthy()
      expect(m.description).toBeTruthy()
      expect(m.badge).toBeTruthy()
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('getMethodMeta', () => {
  it('retourne la méta correcte', () => {
    expect(getMethodMeta('seuils').color).toBe('#22c55e')
    expect(getMethodMeta('karvonen').color).toBe('#facc15')
    expect(getMethodMeta('custom').badge).toBe('Custom')
  })
})

describe('requiredFieldsFor', () => {
  it('seuils → max_hr, aerobic_threshold_hr, threshold_hr', () => {
    expect(requiredFieldsFor('seuils')).toEqual(['max_hr', 'aerobic_threshold_hr', 'threshold_hr'])
  })

  it('test30 → max_hr, threshold_hr', () => {
    expect(requiredFieldsFor('test30')).toEqual(['max_hr', 'threshold_hr'])
  })

  it('karvonen → max_hr, resting_hr', () => {
    expect(requiredFieldsFor('karvonen')).toEqual(['max_hr', 'resting_hr'])
  })

  it('pct_max → max_hr seul', () => {
    expect(requiredFieldsFor('pct_max')).toEqual(['max_hr'])
  })

  it('auto → birth_year seul', () => {
    expect(requiredFieldsFor('auto')).toEqual(['birth_year'])
  })

  it('deduced → aucun champ requis', () => {
    expect(requiredFieldsFor('deduced')).toEqual([])
  })

  it('custom → hr_zones_custom', () => {
    expect(requiredFieldsFor('custom')).toEqual(['hr_zones_custom'])
  })
})
