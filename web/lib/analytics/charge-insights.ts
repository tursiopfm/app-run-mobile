// web/lib/analytics/charge-insights.ts
import type { DailyLoad, DailyMetrics } from './fatigue'
import type { CesActivity, WeeklyLoadByCategory, SportCategoryKey, FreshnessResult, FreshnessZone, LoadBalanceResult, SportDistribution, IntensityLabel, IntensityShareCes, TopActivity, RampRateResult, RampRateLabel, InsightsResult, StatusId, ChargeSportPayload } from './charge-insights.types'
import { FRESHNESS, MONOTONY, RAMP_RATE, LOAD_BALANCE, STRAIN } from './charge-thresholds'
import type { HrZone } from '@/lib/health/hr-zones'
import { hrZoneForAvgHr } from '@/lib/health/hr-zones'

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

export function computeSportDistribution(
  activities: CesActivity[],
  windowDays: number,
  now: Date = new Date(),
): SportDistribution {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (windowDays - 1))

  const acc: SportDistribution = { run: 0, ride: 0, swim: 0, other: 0, total: 0 }
  for (const a of activities) {
    if (!Number.isFinite(a.ces) || a.ces == null) continue
    const d = a.startDate.slice(0, 10)
    if (d < dateKey(start) || d > dateKey(end)) continue
    const cat = classifySportCategory(a.rawSportType)
    acc[cat] += a.ces
    acc.total += a.ces
  }
  acc.run   = Math.round(acc.run)
  acc.ride  = Math.round(acc.ride)
  acc.swim  = Math.round(acc.swim)
  acc.other = Math.round(acc.other)
  acc.total = Math.round(acc.total)
  return acc
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

// ── Intensity distribution ───────────────────────────────────────────────────

const INTENSITY_ORDER: IntensityLabel[] = [
  'Récupération', 'Footing', 'Endurance active', 'Seuil', 'VMA', 'Non déterminée',
]

const MANUAL_TO_LABEL: Record<string, IntensityLabel> = {
  recuperation:     'Récupération',
  footing:          'Footing',
  endurance_active: 'Endurance active',
  sortie_longue:    'Endurance active',
  cotes:            'Footing',
  vma:              'VMA',
  seuil:            'Seuil',
  seuil_tempo:      'Seuil',
}

function labelFromName(name: string): IntensityLabel | null {
  const n = name.toLowerCase()
  if (n.includes('récup') || n.includes('recup')) return 'Récupération'
  if (n.includes('footing') || n.includes(' ef ') || n.includes('endurance facile')) return 'Footing'
  if (n.includes('sortie longue') || n.includes(' sl ') || n.includes('long run') || n.includes('endurance')) return 'Endurance active'
  if (n.includes('vma') || n.includes('400') || n.includes('200') || n.includes('fractionné') || n.includes('interval') || n.includes('répétition')) return 'VMA'
  if (n.includes('seuil') || n.includes('tempo') || n.includes('threshold')) return 'Seuil'
  return null
}

function labelFromZone(zone: number): IntensityLabel {
  if (zone <= 1) return 'Récupération'
  if (zone === 2) return 'Endurance active'
  if (zone === 3) return 'Footing'
  if (zone === 4) return 'Seuil'
  return 'VMA'
}

function classifyIntensity(a: CesActivity, zones: HrZone[]): IntensityLabel {
  if (a.manualIntensity && MANUAL_TO_LABEL[a.manualIntensity]) return MANUAL_TO_LABEL[a.manualIntensity]
  const fromName = labelFromName(a.name)
  if (fromName) return fromName
  if (a.avgHr != null && zones.length > 0) {
    const z = hrZoneForAvgHr(a.avgHr, zones)
    if (z !== null) return labelFromZone(z)
  }
  return 'Non déterminée'
}

// ── Top load activities ──────────────────────────────────────────────────────

const SPORT_LABELS: Record<string, string> = {
  Run: 'Course', TrailRun: 'Trail', Ride: 'Vélo', VirtualRide: 'Home trainer',
  EBikeRide: 'E-Bike', GravelRide: 'Gravel', MountainBikeRide: 'VTT',
  Swim: 'Natation', Walk: 'Marche', Hike: 'Rando', WeightTraining: 'Muscu',
}

export function computeTopLoadActivities(
  activities: CesActivity[],
  windowDays: number,
  n: number,
  zones: HrZone[],
  now: Date = new Date(),
): TopActivity[] {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (windowDays - 1))

  const inWindow = activities.filter(a => {
    if (!Number.isFinite(a.ces) || a.ces == null || a.ces <= 0) return false
    const d = a.startDate.slice(0, 10)
    return d >= dateKey(start) && d <= dateKey(end)
  })
  const totalCes = inWindow.reduce((s, a) => s + a.ces, 0)
  return [...inWindow]
    .sort((a, b) => b.ces - a.ces)
    .slice(0, n)
    .map(a => ({
      id:             a.id,
      date:           a.startDate,
      sport:          SPORT_LABELS[a.rawSportType] ?? a.rawSportType,
      name:           a.name,
      ces:            Math.round(a.ces),
      durationSec:    a.movingTimeSec ?? 0,
      intensityLabel: classifyIntensity(a, zones),
      typeLabel:      a.workoutType ?? null,
      share7dPct:     totalCes > 0 ? Math.round((a.ces / totalCes) * 100) : 0,
    }))
}

// ── Ramp Rate ────────────────────────────────────────────────────────────────

export function computeRampRate(weeks: WeeklyLoadByCategory[]): RampRateResult {
  if (weeks.length < 2) return { deltaWeekPct: 0, label: 'stable', prevWeekZero: false }
  const cur  = weeks[weeks.length - 1].total
  const prev = weeks[weeks.length - 2].total
  const prevZero = prev === 0
  const delta = prevZero ? (cur > 0 ? 1 : 0) : (cur - prev) / prev

  let label: RampRateLabel
  if (prevZero && cur > 0)                          label = 'progressive-resume'
  else if (delta > RAMP_RATE.fastRise)              label = 'fast-rise'
  else if (delta > RAMP_RATE.controlledRise)        label = 'controlled-rise'
  else if (delta >= -RAMP_RATE.controlledRise)      label = 'stable'
  else if (delta > RAMP_RATE.decline)               label = 'declining'
  else                                              label = 'sharp-decline'

  return { deltaWeekPct: Math.round(delta * 1000) / 1000, label, prevWeekZero: prevZero }
}

export function computeIntensityDistribution(
  activities: CesActivity[],
  windowDays: number,
  zones: HrZone[],
  now: Date = new Date(),
): IntensityShareCes[] {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (windowDays - 1))

  const byLabel = new Map<IntensityLabel, number>()
  for (const a of activities) {
    if (!Number.isFinite(a.ces) || a.ces == null) continue
    const d = a.startDate.slice(0, 10)
    if (d < dateKey(start) || d > dateKey(end)) continue
    const label = classifyIntensity(a, zones)
    byLabel.set(label, (byLabel.get(label) ?? 0) + a.ces)
  }
  return INTENSITY_ORDER
    .filter(l => byLabel.has(l))
    .map(l => ({ label: l, ces: Math.round(byLabel.get(l)!) }))
}

// ── Load Insights Engine ─────────────────────────────────────────────────────

const HEADLINES: Record<StatusId, string> = {
  insufficient:    "Pas assez de données pour estimer ta forme. Reviens après quelques séances.",
  overloaded:      "Charge élevée à surveiller. Récupération conseillée.",
  peak:            "Pic de charge cette semaine. Reste attentif à la récupération.",
  loaded:          "Fatigue normale d'entraînement. C'est cohérent en phase de charge.",
  'under-trained': "Tu es très frais mais ta base de forme est basse. Tu peux remonter le volume.",
  'very-fresh':    "Tu es bien reposé. Bonne fenêtre pour une séance intense.",
  light:           "Charge récente plus faible que d'habitude. Utile si tu récupères.",
  progressing:     "Progression élevée. Tu charges plus que ta moyenne.",
  balanced:        "Charge équilibrée. Tu peux suivre ton plan normalement.",
}

function pickStatus(p: ChargeSportPayload): StatusId {
  if (p.historyDays < 14) return 'insufficient'
  const last = p.dailyMetrics[p.dailyMetrics.length - 1]
  const tsb = last?.tsb ?? 0
  const ctl = last?.ctl ?? 0
  const ratio = computeLoadBalanceRatio(p.dailyMetrics, p.dailyLoads).sumRatio7vs28

  if (tsb <= FRESHNESS.highFatigue)                                   return 'overloaded'
  if (ratio > LOAD_BALANCE.high)                                      return 'peak'
  if (tsb <= FRESHNESS.normalFatigue)                                 return 'loaded'
  if (tsb >= FRESHNESS.veryFresh && ctl < 30)                         return 'under-trained'
  if (tsb >= FRESHNESS.veryFresh)                                     return 'very-fresh'
  if (ratio > 0 && ratio < LOAD_BALANCE.low)                          return 'light'
  if (ratio >= LOAD_BALANCE.balanced && ratio <= LOAD_BALANCE.high)   return 'progressing'
  return 'balanced'
}

function buildNotes(p: ChargeSportPayload): string[] {
  const notes: string[] = []
  const sd7  = p.sportDistribution['7']
  const sd28 = p.sportDistribution['28']

  if (sd7.total > 0 && sd7.run / sd7.total > 0.7)
    notes.push("Tu as beaucoup chargé en course à pied.")
  if (sd7.total > 0 && sd28.total > 0 && sd7.ride / sd7.total > 0.5 && sd28.ride / sd28.total < 0.3)
    notes.push("La charge vélo compense une baisse de charge running.")

  const sum7 = p.dailyLoads.slice(-7).reduce((s, d) => s + d.ces, 0)
  if (p.activeDays7d <= 2 && sum7 > 0)
    notes.push("Beaucoup de charge concentrée sur peu de jours.")

  if (p.monotony7d >= 2.0)
    notes.push("Semaine peu variée. Pense à alterner intensités et durées.")
  if (p.strain7d > STRAIN.high)
    notes.push("Semaine très exigeante, prends le temps de récupérer.")

  const intense = p.intensityDistribution['7'].reduce((s, x) => s + (x.label === 'Seuil' || x.label === 'VMA' ? x.ces : 0), 0)
  const total7  = p.intensityDistribution['7'].reduce((s, x) => s + x.ces, 0)
  if (total7 > 0 && intense / total7 > 0.4)
    notes.push("Beaucoup d'intensité haute cette semaine.")

  const sportsCount = [sd7.run, sd7.ride, sd7.swim, sd7.other].filter(v => v > 0).length
  const anyDominant = sd7.total > 0 && [sd7.run, sd7.ride, sd7.swim, sd7.other].some(v => v / sd7.total > 0.4)
  if (sportsCount >= 2 && !anyDominant)
    notes.push("Bonne variété entre sports.")

  if (p.noCesActivities28d > 0)
    notes.push(`${p.noCesActivities28d} activité(s) récente(s) n'ont pas de charge exploitable.`)

  const ctl = p.dailyMetrics[p.dailyMetrics.length - 1]?.ctl ?? 0
  if (ctl < 20 && p.historyDays >= 14)
    notes.push("Ta base de forme est encore basse, progresse graduellement.")

  return notes
}

export function computeLoadInsights(p: ChargeSportPayload): InsightsResult {
  const status = pickStatus(p)
  return { status, headline: HEADLINES[status], notes: buildNotes(p) }
}
