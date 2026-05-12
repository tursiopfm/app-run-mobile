// web/lib/analytics/charge-insights.ts
import type { DailyLoad } from './fatigue'
import type { CesActivity } from './charge-insights.types'

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isoDateOf(activity: CesActivity): string {
  return activity.startDate.slice(0, 10)
}

export function getDailyLoadSeries(
  activities: CesActivity[],
  days: number,
  now: Date = new Date(),
): DailyLoad[] {
  if (days <= 0) return []
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))

  const cesByDate = new Map<string, number>()
  for (const a of activities) {
    if (!Number.isFinite(a.ces) || a.ces == null) continue
    const key = isoDateOf(a)
    if (key < dateKey(start) || key > dateKey(end)) continue
    cesByDate.set(key, (cesByDate.get(key) ?? 0) + a.ces)
  }

  const result: DailyLoad[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = dateKey(cursor)
    result.push({ date: key, ces: cesByDate.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}
