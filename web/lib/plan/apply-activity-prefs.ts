import type { ActivityType, UserActivityPref } from '@/types/activity-types'

// Convention : on offset l'ordre de seed avec +1000 pour s'assurer qu'une pref
// explicite (displayOrder typiquement 0..N) précède toujours un type sans pref.
const SEED_OFFSET = 1000

export interface OrderedActivityType extends ActivityType {
  displayOrder: number
}

export function applyActivityPrefs(
  types: ActivityType[],
  prefs: UserActivityPref[],
): OrderedActivityType[] {
  const prefBySlug = new Map(prefs.map(p => [p.activitySlug, p]))

  const enriched = types.map((t, seedIdx) => {
    const pref = prefBySlug.get(t.slug)
    return {
      ...t,
      _isVisible: pref ? pref.isVisible : true,
      displayOrder: pref ? pref.displayOrder : SEED_OFFSET + seedIdx,
    }
  })

  return enriched
    .filter(t => t._isVisible)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(({ _isVisible: _v, ...rest }) => rest)
}
