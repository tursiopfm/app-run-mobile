import { applyActivityPrefs } from '@/lib/plan/apply-activity-prefs'
import type { ActivityType, UserActivityPref } from '@/types/activity-types'

const types: ActivityType[] = [
  { id: '1', slug: 'sortie_longue', label: 'Sortie longue', defaultIntensity: 2, category: 'run',  isSystem: true },
  { id: '2', slug: 'fractionne',    label: 'Fractionné',    defaultIntensity: 5, category: 'run',  isSystem: true },
  { id: '3', slug: 'velo',          label: 'Vélo',          defaultIntensity: 2, category: 'bike', isSystem: true },
  { id: '4', slug: 'tennis',        label: 'Tennis',        defaultIntensity: 2, category: 'other', isSystem: false },
]

describe('applyActivityPrefs', () => {
  it('returns all visible types in seed order when no prefs', () => {
    const result = applyActivityPrefs(types, [])
    expect(result.map(t => t.slug)).toEqual(['sortie_longue', 'fractionne', 'velo', 'tennis'])
  })

  it('hides types where isVisible=false', () => {
    const prefs: UserActivityPref[] = [
      { activitySlug: 'velo', isVisible: false, displayOrder: 0 },
    ]
    const result = applyActivityPrefs(types, prefs)
    expect(result.map(t => t.slug)).toEqual(['sortie_longue', 'fractionne', 'tennis'])
  })

  it('respects displayOrder over seed order', () => {
    const prefs: UserActivityPref[] = [
      { activitySlug: 'tennis',        isVisible: true, displayOrder: 0 },
      { activitySlug: 'sortie_longue', isVisible: true, displayOrder: 1 },
      { activitySlug: 'fractionne',    isVisible: true, displayOrder: 2 },
      { activitySlug: 'velo',          isVisible: true, displayOrder: 3 },
    ]
    const result = applyActivityPrefs(types, prefs)
    expect(result.map(t => t.slug)).toEqual(['tennis', 'sortie_longue', 'fractionne', 'velo'])
  })

  it('falls back to seed order for types without a pref', () => {
    const prefs: UserActivityPref[] = [
      { activitySlug: 'fractionne', isVisible: true, displayOrder: 0 },
    ]
    const result = applyActivityPrefs(types, prefs)
    expect(result.map(t => t.slug)[0]).toBe('fractionne')
    expect(result.map(t => t.slug)).toContain('sortie_longue')
  })

  it('ignores prefs that reference an unknown slug', () => {
    const prefs: UserActivityPref[] = [
      { activitySlug: 'unknown', isVisible: true, displayOrder: 0 },
    ]
    const result = applyActivityPrefs(types, prefs)
    expect(result).toHaveLength(4)
  })
})
