// web/lib/analytics/charge-insights.ts
import type { DailyLoad, DailyMetrics } from './fatigue'
import type { CesActivity, WeeklyLoadByCategory, SportCategoryKey, FreshnessResult, FreshnessZone, LoadBalanceResult } from './charge-insights.types'
import { FRESHNESS, MONOTONY } from './charge-thresholds'

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

// ── Monotony / Strain / Active days / Peak day ───────────────────────────────

function tail7(loads: DailyLoad[]): DailyLoad[] {
  return loads.slice(-7)
}

function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 }
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return { mean, std: Math.sqrt(variance) }
}

export function computeMonotony7d(loads: DailyLoad[]): number {
  const window = tail7(loads).map(d => d.ces)
  if (window.length === 0) return 0
  const { mean, std } = meanStd(window)
  if (std === 0) return mean === 0 ? 0 : MONOTONY.repetitiveMin
  return Math.round((mean / std) * 100) / 100
}

export function computeStrain7d(loads: DailyLoad[]): number {
  const sum = tail7(loads).reduce((s, d) => s + d.ces, 0)
  return Math.round(sum * computeMonotony7d(loads))
}

export function computeActiveDays7d(loads: DailyLoad[]): number {
  return tail7(loads).filter(d => d.ces > 0).length
}

export function computePeakDay7d(loads: DailyLoad[]): { date: string; ces: number } | null {
  const w = tail7(loads)
  const best = w.reduce<{ date: string; ces: number } | null>((acc, d) => {
    if (d.ces <= 0) return acc
    if (!acc || d.ces > acc.ces) return { date: d.date, ces: d.ces }
    return acc
  }, null)
  return best
}

export function computeLoadBalanceRatio(
  metrics: DailyMetrics[],
  dailyLoads: DailyLoad[],
): LoadBalanceResult {
  if (metrics.length === 0 || dailyLoads.length === 0)
    return { ewmaRatio: 0, sumRatio7vs28: 0 }
  const last = metrics[metrics.length - 1]
  const ewmaRatio = last.ctl > 0 ? Math.round((last.atl / last.ctl) * 100) / 100 : 0

  const tail7  = dailyLoads.slice(-7)
  const tail28 = dailyLoads.slice(-28)
  const sum7   = tail7.reduce((s, d) => s + d.ces, 0)
  const sum28  = tail28.reduce((s, d) => s + d.ces, 0)
  const avg7Week = sum28 / 4
  const sumRatio7vs28 = avg7Week > 0 ? Math.round((sum7 / avg7Week) * 100) / 100 : 0

  return { ewmaRatio, sumRatio7vs28 }
}
