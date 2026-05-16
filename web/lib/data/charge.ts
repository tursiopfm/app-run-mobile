// web/lib/data/charge.ts
import { createClient } from '@/lib/database/supabase-server'
import { buildDailyMetrics, type DailyMetrics, type DailyLoad } from '@/lib/analytics/fatigue'
import { calculateHrZones, type HrZone, type HrZoneMethod } from '@/lib/health/hr-zones'
import {
  getDailyLoadSeries, getWeeklyLoadByCategory,
  computeSportDistribution, computeIntensityDistribution,
  computeTopLoadActivities, computeMonotony7d, computeStrain7d,
  computeActiveDays7d, computePeakDay7d, computeRampRate,
  computeLoadInsights, classifySportCategory,
} from '@/lib/analytics/charge-insights'
import type {
  CesActivity, ChargeSportPayload, SportCategoryKey,
} from '@/lib/analytics/charge-insights.types'

export type ChargeSportFilterKey = 'all' | 'run' | 'ride' | 'swim'

export type ChargePageData = {
  perSport:    Record<ChargeSportFilterKey, ChargeSportPayload>
  generatedAt: string
}

type ActivityRow = {
  id:                string
  sport_type:        string
  // manual_sport_type override sport_type pour la classification de catégorie
  // (run/ride/swim). Sans ça, une activité re-tagguée à la main "Run" depuis
  // Strava "Workout" est classée 'other' et disparaît du Charge Run.
  manual_sport_type: string | null
  name:              string
  start_time:        string
  ces:               number | null
  avg_hr:            number | null
  distance_m:        number | null
  elevation_gain_m:  number | null
  moving_time_sec:   number | null
  manual_intensity:  string | null
}

function rowToCesActivity(r: ActivityRow): CesActivity {
  return {
    id:              r.id,
    rawSportType:    r.manual_sport_type ?? r.sport_type,
    name:            r.name,
    startDate:       r.start_time,
    ces:             r.ces ?? 0,
    movingTimeSec:   r.moving_time_sec,
    distanceMeters:  r.distance_m,
    elevationGainM:  r.elevation_gain_m,
    avgHr:           r.avg_hr,
    manualIntensity: r.manual_intensity,
    workoutType:     null,
  }
}

function filterByCategory(acts: CesActivity[], cat: SportCategoryKey | 'all'): CesActivity[] {
  if (cat === 'all') return acts
  return acts.filter(a => classifySportCategory(a.rawSportType) === cat)
}

function buildSportPayload(
  acts: CesActivity[],
  zones: HrZone[],
  now: Date,
): ChargeSportPayload {
  const dailyLoads   = getDailyLoadSeries(acts, 90, now)
  const dailyMetrics = buildDailyMetrics(dailyLoads)
  const weeklyLoad   = getWeeklyLoadByCategory(acts, 10, now)
  const rampRate     = computeRampRate(weeklyLoad)
  const historyDays  = dailyMetrics.length

  const sportDist = {
    '7':  computeSportDistribution(acts, 7,  now),
    '28': computeSportDistribution(acts, 28, now),
    '70': computeSportDistribution(acts, 70, now),
  }
  const intensityDist = {
    '7':  computeIntensityDistribution(acts, 7,  zones, now),
    '28': computeIntensityDistribution(acts, 28, zones, now),
    '70': computeIntensityDistribution(acts, 70, zones, now),
  }
  const top = computeTopLoadActivities(acts, 7, 5, zones, now)

  const monotony7d   = computeMonotony7d(dailyLoads)
  const strain7d     = computeStrain7d(dailyLoads)
  const activeDays7d = computeActiveDays7d(dailyLoads)
  const peakDay7d    = computePeakDay7d(dailyLoads)

  const cesMissing = (windowDays: number) => {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - (windowDays - 1))
    return acts.filter(a => {
      const d = a.startDate.slice(0, 10)
      const inRange = d >= start.toISOString().slice(0, 10) && d <= end.toISOString().slice(0, 10)
      return inRange && (a.ces === 0 || !Number.isFinite(a.ces))
    }).length
  }

  const partial: ChargeSportPayload = {
    dailyMetrics, dailyLoads,
    weeklyLoadByCategory: weeklyLoad,
    sportDistribution:    sportDist,
    intensityDistribution: intensityDist,
    top,
    monotony7d, strain7d, activeDays7d, peakDay7d,
    rampRate,
    insights:           { status: 'balanced', headline: '', notes: [] },
    noCesActivities7d:  cesMissing(7),
    noCesActivities28d: cesMissing(28),
    historyDays,
  }
  partial.insights = computeLoadInsights(partial)
  return partial
}

export async function getChargePageData(userId: string): Promise<ChargePageData> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 90)

  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase
      .from('activities')
      .select('id, sport_type, manual_sport_type, name, start_time, ces, avg_hr, distance_m, elevation_gain_m, moving_time_sec, manual_intensity')
      .eq('user_id', userId)
      .gte('start_time', since.toISOString())
      .is('deleted_at', null)
      .order('start_time', { ascending: true }),
    supabase
      .from('profiles')
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year')
      .eq('id', userId)
      .single(),
  ])

  const activities = (rows ?? []).map((r) => rowToCesActivity(r as ActivityRow))

  const zones: HrZone[] = (() => {
    if (!profile) return []
    const p = profile as Record<string, number | null>
    let method: HrZoneMethod = 'auto'
    if (p.max_hr && p.aerobic_threshold_hr && p.threshold_hr) method = 'seuils'
    else if (p.max_hr && p.threshold_hr)                      method = 'test30'
    else if (p.max_hr && p.resting_hr)                        method = 'karvonen'
    else if (p.max_hr)                                         method = 'pct_max'
    return calculateHrZones({
      method, maxHr: p.max_hr, restingHr: p.resting_hr,
      aerobicThresholdHr: p.aerobic_threshold_hr, thresholdHr: p.threshold_hr, birthYear: p.birth_year,
    }).zones
  })()

  const now = new Date()
  const perSport: Record<ChargeSportFilterKey, ChargeSportPayload> = {
    all:  buildSportPayload(activities,                              zones, now),
    run:  buildSportPayload(filterByCategory(activities, 'run'),    zones, now),
    ride: buildSportPayload(filterByCategory(activities, 'ride'),   zones, now),
    swim: buildSportPayload(filterByCategory(activities, 'swim'),   zones, now),
  }

  return { perSport, generatedAt: new Date().toISOString() }
}
