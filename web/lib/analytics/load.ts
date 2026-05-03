import { computeCes, type ActivityInput } from './effort-score'
import type { DailyLoad } from './fatigue'

export function aggregateToDailyLoad(activities: ActivityInput[]): DailyLoad[] {
  const map = new Map<string, number>()
  for (const a of activities) {
    const date = a.startDate.split('T')[0]
    map.set(date, (map.get(date) ?? 0) + computeCes(a))
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ces]) => ({ date, ces }))
}
