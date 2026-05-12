// web/lib/analytics/charge-insights.ts
import type { DailyLoad, DailyMetrics } from './fatigue'
import type { CesActivity, WeeklyLoadByCategory, SportCategoryKey, FreshnessResult, FreshnessZone } from './charge-insights.types'
import { FRESHNESS } from './charge-thresholds'

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

const RUN_TYPES  = new Set(['Run', 'TrailRun'])
const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide', 'GravelRide', 'MountainBikeRide'])
const SWIM_TYPES = new Set(['Swim'])

export function classifySportCategory(rawSportType: string): SportCategoryKey {
  if (RUN_TYPES.has(rawSportType))  return 'run'
  if (RIDE_TYPES.has(rawSportType)) return 'ride'
  if (SWIM_TYPES.has(rawSportType)) return 'swim'
  return 'other'
}

function isoMondayOf(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = out.getUTCDay()                 // 0 = Sun, 1 = Mon, …
  const diff = dow === 0 ? -6 : 1 - dow
  out.setUTCDate(out.getUTCDate() + diff)
  return out
}

function weekLabel(monday: Date): string {
  const dd = String(monday.getUTCDate()).padStart(2, '0')
  const mm = String(monday.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

export function getWeeklyLoadByCategory(
  activities: CesActivity[],
  weeks: number,
  now: Date = new Date(),
): WeeklyLoadByCategory[] {
  if (weeks <= 0) return []
  const currentMonday = isoMondayOf(now)
  const result: WeeklyLoadByCategory[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(currentMonday)
    monday.setUTCDate(monday.getUTCDate() - 7 * i)
    const nextMonday = new Date(monday)
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7)

    const slot: WeeklyLoadByCategory = {
      weekStart: dateKey(monday),
      weekLabel: weekLabel(monday),
      run: 0, ride: 0, swim: 0, other: 0, total: 0, avg4w: 0,
    }

    for (const a of activities) {
      const ad = new Date(a.startDate)
      if (ad < monday || ad >= nextMonday) continue
      if (!Number.isFinite(a.ces) || a.ces == null) continue
      const cat = classifySportCategory(a.rawSportType)
      slot[cat] += a.ces
      slot.total += a.ces
    }
    result.push(slot)
  }

  // avg4w: moyenne des totaux sur les 4 dernières semaines incluant la courante
  for (let i = 0; i < result.length; i++) {
    const start = Math.max(0, i - 3)
    const slice = result.slice(start, i + 1)
    const sum = slice.reduce((s, w) => s + w.total, 0)
    result[i].avg4w = Math.round((sum / slice.length) * 10) / 10
  }
  return result
}

// ── Freshness / Acute / Chronic ──────────────────────────────────────────────

function freshnessZoneFor(tsb: number): FreshnessZone {
  if (tsb >= FRESHNESS.veryFresh)     return 'very-fresh'
  if (tsb >= FRESHNESS.fresh)         return 'fresh'
  if (tsb > FRESHNESS.normalFatigue)  return 'balanced'
  if (tsb > FRESHNESS.highFatigue)    return 'normal-fatigue'
  return 'high-fatigue'
}

export function computeAcuteLoad7d(metrics: DailyMetrics[]): number {
  if (metrics.length === 0) return 0
  return metrics[metrics.length - 1].atl
}

export function computeChronicLoad(metrics: DailyMetrics[]): number {
  if (metrics.length === 0) return 0
  return metrics[metrics.length - 1].ctl
}

export function computeFreshness(metrics: DailyMetrics[]): FreshnessResult {
  if (metrics.length === 0) return { tsb: 0, deltaVsWeekAgo: 0, zone: 'balanced' }
  const last = metrics[metrics.length - 1]
  const sevenAgo = metrics[metrics.length - 8] ?? metrics[0]
  const delta = Math.round((last.tsb - sevenAgo.tsb) * 10) / 10
  return { tsb: last.tsb, deltaVsWeekAgo: delta, zone: freshnessZoneFor(last.tsb) }
}
