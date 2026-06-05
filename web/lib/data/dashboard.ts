import { createClient } from '@/lib/database/supabase-server'
import { buildDailyMetrics, type DailyLoad, type DailyMetrics } from '@/lib/analytics/fatigue'
import { EWMA_WARMUP_DAYS, CHARGE_DISPLAY_DAYS } from '@/lib/analytics/charge-insights'
import { type SportKey, SPORT_TYPE_MAP } from '@/lib/design/sports'
import { effectiveWorkoutType, type WorkoutType } from '@/lib/activities/intensity'

export type ActivityRow = {
  id: string
  sport_type: string
  name: string
  start_time: string
  ces: number | null
  avg_hr: number | null
  distance_m: number | null
  elevation_gain_m: number | null
  moving_time_sec: number | null
  manual_intensity: string | null
  manual_sport_type: string | null
  manual_workout_type: string | null
  manual_distance_m: number | null
  manual_elevation_gain_m: number | null
  manual_moving_time_sec: number | null
}

export type DaySession = {
  day: string
  label: string
  volumeKm: number
  dPlus: number
  durationSec: number
}

export type DailyHistoryEntry = { date: string; km: number; dPlus: number }

export type SportOverview = {
  weekKm: number
  weekDPlus: number
  weekSessions: number
  dailyKm: number[]
  dailyDPlus: number[]
  dailyDurationSec: number[]
  dailyLabels: string[]
  ytdKm: number
  ytdDPlus: number
  ytdSessions: number
  monthlyKm: number[]
  monthlyDPlus: number[]
  atl: number
  ctl: number
  tsb: number
  weekCes: number
  last7Tsb: number[]
  weeklyPoints: WeeklyPoint[]
  cumulMonths: MonthSeries[]
  cumulYears: MonthSeries[]
  workoutTypeBreakdown: WorkoutTypeShare[]
  dailyHistory: DailyHistoryEntry[]
}

type SlimActivity = {
  sport_type:              string
  // manual_sport_type est le re-tag utilisateur ; quand présent il OVERRIDE
  // sport_type pour toutes les agrégations par sport. Sans ça, une activité
  // tagguée à la main "Run" depuis Strava "Workout" disparaît du total Run
  // annuel — bug constaté 2026-05-16.
  manual_sport_type:       string | null
  start_time:              string
  distance_m:              number | null
  elevation_gain_m:        number | null
  // Overrides utilisateur : prioritaires sur les valeurs Strava pour TOUS les
  // cumuls (semaine, mois, année, historique). Le sync Strava ne les touche pas.
  manual_distance_m:       number | null
  manual_elevation_gain_m: number | null
}

export type WorkoutTypeShare = {
  // `null` means "Non défini" (no manual override and no auto-detected type).
  type: WorkoutType | null
  km: number
}

export type WeeklyPoint = {
  weekLabel: string
  km: number
  dPlus: number
}

export type MonthSeries = {
  label: string
  color: string
  dailyCumul: number[]
}

export type DashboardData = {
  dailyMetrics: DailyMetrics[]
  recentActivities: ActivityRow[]
  hasActivities: boolean
  sportOverviews: Record<SportKey, SportOverview>
  weekSessions: DaySession[]
}

const DAY_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTH_CUMUL_COLORS = ['#4ADE80', '#FF7900', '#FACC15', '#38BDF8']
const YEAR_COLOR_PALETTE = [
  '#38BDF8', '#EF4444', '#EAB308', '#22C55E',
  '#F97316', '#06B6D4', '#8B5CF6', '#FB7185',
  '#FDE047', '#86EFAC', '#FDBA74', '#67E8F9',
  '#C4B5FD', '#FECDD3',
]
const MONTH_SHORT_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const WORKOUT_TYPE_ORDER: (WorkoutType | null)[] = [
  'sortie_longue', 'fractionne', 'seuil_tempo', 'cotes', 'course', 'runtaf', 'velotaf', 'footing', null,
]

// ISO week day to 0-based Mon index: Sun=6, Mon=0, Tue=1 … Sat=5
function toMonIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const jsDay = d.getDay()
  const diff = jsDay === 0 ? -6 : 1 - jsDay
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function mondayOfCurrentWeek(): Date {
  const now = new Date()
  const idx = toMonIndex(now.getDay())
  const mon = new Date(now)
  mon.setDate(now.getDate() - idx)
  mon.setHours(0, 0, 0, 0)
  return mon
}

// Construit une série quotidienne (UTC) de la charge CES sur `days` jours
// glissants. Logique strictement identique à `getDailyLoadSeries` de
// charge-insights.ts pour garantir que ATL/CTL/TSB du Cockpit collent à
// ceux de l'onglet Charge (même fenêtre d'amorçage EWMA_WARMUP_DAYS).
function buildWindowedLoads(
  rows: ActivityRow[],
  days: number,
  now: Date = new Date(),
): DailyLoad[] {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  const startKey = start.toISOString().slice(0, 10)
  const endKey   = end.toISOString().slice(0, 10)

  const loadMap = new Map<string, number>()
  for (const row of rows) {
    const ces = row.ces
    if (ces == null || !Number.isFinite(ces)) continue
    const key = row.start_time.slice(0, 10)
    if (key < startKey || key > endKey) continue
    loadMap.set(key, (loadMap.get(key) ?? 0) + ces)
  }

  const result: DailyLoad[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    result.push({ date: key, ces: loadMap.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

function filterSport(activities: ActivityRow[], types: readonly string[] | null): ActivityRow[] {
  if (!types) return activities
  // manual_sport_type override sport_type pour la catégorisation. Sans ça,
  // les activités re-tagguées à la main (ex: Strava "Workout" → Run) sont
  // ignorées par le filtre Run/Ride/Swim.
  return activities.filter((a) => types.includes(a.manual_sport_type ?? a.sport_type))
}

function dayOfYearIdx(d: Date): number {
  const y = d.getFullYear()
  return Math.floor(
    (Date.UTC(y, d.getMonth(), d.getDate()) - Date.UTC(y, 0, 1)) / 86_400_000,
  )
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function buildCumulYears(
  yearActivities: SlimActivity[],
  types: readonly string[] | null,
  now: Date,
): MonthSeries[] {
  const filtered = types
    ? yearActivities.filter((a) => types.includes(a.manual_sport_type ?? a.sport_type))
    : yearActivities

  const byYear = new Map<number, SlimActivity[]>()
  for (const a of filtered) {
    const y = new Date(a.start_time).getFullYear()
    const arr = byYear.get(y)
    if (arr) arr.push(a)
    else byYear.set(y, [a])
  }

  const series: MonthSeries[] = []
  const currentYear = now.getFullYear()
  const yearsWithData = Array.from(byYear.keys()).sort((a, b) => a - b)

  for (const y of yearsWithData) {
    const yacts = byYear.get(y)
    if (!yacts || yacts.length === 0) continue

    const isCurrentYear = y === currentYear
    const totalDays = isCurrentYear
      ? dayOfYearIdx(now) + 1
      : isLeapYear(y) ? 366 : 365

    const dayKm = Array(totalDays).fill(0) as number[]
    for (const a of yacts) {
      const ad = new Date(a.start_time)
      const idx = dayOfYearIdx(ad)
      if (idx >= 0 && idx < totalDays) dayKm[idx] += ((a.manual_distance_m ?? a.distance_m) ?? 0) / 1000
    }

    const dailyCumul: number[] = []
    let cumul = 0
    for (let d = 0; d < totalDays; d++) {
      cumul += dayKm[d]
      dailyCumul.push(Math.round(cumul * 10) / 10)
    }

    const offset = Math.max(0, currentYear - y)
    const color = YEAR_COLOR_PALETTE[Math.min(offset, YEAR_COLOR_PALETTE.length - 1)]
    series.push({ label: String(y), color, dailyCumul })
  }

  return series
}

function buildSportOverview(
  all365: ActivityRow[],
  yearActivities: SlimActivity[],
  types: readonly string[] | null,
  monday: Date,
  nextMonday: Date,
  janFirst: Date,
  now: Date,
): SportOverview {
  const acts = filterSport(all365, types)

  const weekActs = acts.filter((a) => {
    const t = new Date(a.start_time)
    return t >= monday && t < nextMonday
  })
  const dailyKm          = Array(7).fill(0) as number[]
  const dailyDPlus       = Array(7).fill(0) as number[]
  const dailyDurationSec = Array(7).fill(0) as number[]
  const dailyLabels      = Array(7).fill('') as string[]
  let weekKm = 0, weekDPlus = 0, weekSessions = 0
  for (const a of weekActs) {
    const idx = toMonIndex(new Date(a.start_time).getDay())
    const km  = ((a.manual_distance_m       ?? a.distance_m)       ?? 0) / 1000
    const dp  = (a.manual_elevation_gain_m ?? a.elevation_gain_m) ?? 0
    const sec = (a.manual_moving_time_sec  ?? a.moving_time_sec)  ?? 0
    dailyKm[idx]          += km
    dailyDPlus[idx]       += dp
    dailyDurationSec[idx] += sec
    if (!dailyLabels[idx]) dailyLabels[idx] = a.name
    weekKm    += km
    weekDPlus += dp
    weekSessions++
  }
  const weekCes = Math.round(weekActs.reduce((s, a) => s + (a.ces ?? 0), 0))

  const ytdActs = acts.filter((a) => new Date(a.start_time) >= janFirst)
  const ytdKm    = Math.round(ytdActs.reduce((s, a) => s + ((a.manual_distance_m       ?? a.distance_m)       ?? 0) / 1000, 0) * 10) / 10
  const ytdDPlus = Math.round(ytdActs.reduce((s, a) => s +  ((a.manual_elevation_gain_m ?? a.elevation_gain_m) ?? 0),         0))
  const ytdSessions = ytdActs.length
  const monthlyKm   = Array(12).fill(0) as number[]
  const monthlyDPlus = Array(12).fill(0) as number[]
  for (const a of ytdActs) {
    const mo = new Date(a.start_time).getMonth()
    monthlyKm[mo]   += ((a.manual_distance_m       ?? a.distance_m)       ?? 0) / 1000
    monthlyDPlus[mo] += (a.manual_elevation_gain_m ?? a.elevation_gain_m) ?? 0
  }
  for (let i = 0; i < 12; i++) {
    monthlyKm[i]   = Math.round(monthlyKm[i] * 10) / 10
    monthlyDPlus[i] = Math.round(monthlyDPlus[i])
  }

  // EWMA amorcée sur ~1 an d'historique (cf. buildChargeMetrics) pour que
  // l'ATL/CTL/TSB du jour soit convergé et stable — pas re-amorcé sur une
  // fenêtre glissante de 90 jours dont le 1er jour fait sauter le CTL.
  const loads   = buildWindowedLoads(acts, EWMA_WARMUP_DAYS, now)
  const metrics = buildDailyMetrics(loads)
  const latest  = metrics[metrics.length - 1] ?? { atl: 0, ctl: 0, tsb: 0 }
  const last7Tsb = metrics.slice(-7).map((m) => m.tsb)

  // Weekly points (last 10 weeks)
  const weekMap = new Map<string, { ts: number; km: number; dPlus: number }>()
  for (const a of acts) {
    const ws = getWeekStart(new Date(a.start_time))
    const isoKey = ws.toISOString().slice(0, 10)
    const entry = weekMap.get(isoKey) ?? { ts: ws.getTime(), km: 0, dPlus: 0 }
    entry.km    += ((a.manual_distance_m       ?? a.distance_m)       ?? 0) / 1000
    entry.dPlus += ((a.manual_elevation_gain_m ?? a.elevation_gain_m) ?? 0)
    weekMap.set(isoKey, entry)
  }
  const weeklyPoints: WeeklyPoint[] = Array.from(weekMap.entries())
    .map(([isoKey, data]) => {
      const [, m, d] = isoKey.split('-')
      return { weekLabel: `${d}/${m}`, ts: data.ts, km: Math.round(data.km * 10) / 10, dPlus: Math.round(data.dPlus) }
    })
    .sort((a, b) => a.ts - b.ts)
    .slice(-10)
    .map(({ weekLabel, km, dPlus }) => ({ weekLabel, km, dPlus }))

  // Cumulative km per month (last 4 months)
  const monthActIndex = new Map<string, ActivityRow[]>()
  for (const a of acts) {
    const ad = new Date(a.start_time)
    const key = `${ad.getFullYear()}-${ad.getMonth()}`
    const arr = monthActIndex.get(key)
    if (arr) arr.push(a)
    else monthActIndex.set(key, [a])
  }
  const cumulMonths: MonthSeries[] = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 3 + i, 1)
    const year  = d.getFullYear()
    const month = d.getMonth()
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
    const lastDay = isCurrentMonth ? now.getDate() : new Date(year, month + 1, 0).getDate()
    const dayKm = Array(lastDay).fill(0) as number[]
    for (const a of (monthActIndex.get(`${year}-${month}`) ?? [])) {
      const dayIdx = new Date(a.start_time).getDate() - 1
      if (dayIdx < lastDay) dayKm[dayIdx] += ((a.manual_distance_m ?? a.distance_m) ?? 0) / 1000
    }
    const dailyCumul: number[] = []
    let cumul = 0
    for (let day = 0; day < lastDay; day++) {
      cumul += dayKm[day]
      dailyCumul.push(Math.round(cumul * 10) / 10)
    }
    return { label: `${MONTH_SHORT_FR[month]} ${year}`, color: MONTH_CUMUL_COLORS[i], dailyCumul }
  })

  // Workout-type breakdown (last 30 days) — uses manual override when present,
  // else auto-detects from the title via guessWorkoutType. Swim → always null.
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const workoutTypeMap = new Map<WorkoutType | null, number>()
  for (const a of acts.filter((r) => new Date(r.start_time) >= thirtyDaysAgo)) {
    const effDist = a.manual_distance_m ?? a.distance_m
    if (!effDist) continue
    const sport = a.manual_sport_type ?? a.sport_type
    const t = effectiveWorkoutType(a.manual_workout_type, a.name, sport)
    workoutTypeMap.set(t, (workoutTypeMap.get(t) ?? 0) + effDist / 1000)
  }
  const workoutTypeBreakdown: WorkoutTypeShare[] = WORKOUT_TYPE_ORDER
    .filter((t) => workoutTypeMap.has(t))
    .map((t) => ({ type: t, km: Math.round((workoutTypeMap.get(t) ?? 0) * 10) / 10 }))

  const cumulYears = buildCumulYears(yearActivities, types, now)

  // Daily history across the user's entire activity range (per sport, slim).
  // Used by HistoryBlock to navigate back through past weeks/months/years.
  const fullHistory = types
    ? yearActivities.filter((a) => types.includes(a.manual_sport_type ?? a.sport_type))
    : yearActivities
  const historyMap = new Map<string, { km: number; dPlus: number }>()
  for (const a of fullHistory) {
    const key = localDateKey(new Date(a.start_time))
    const entry = historyMap.get(key) ?? { km: 0, dPlus: 0 }
    entry.km    += ((a.manual_distance_m       ?? a.distance_m)       ?? 0) / 1000
    entry.dPlus += ((a.manual_elevation_gain_m ?? a.elevation_gain_m) ?? 0)
    historyMap.set(key, entry)
  }
  const dailyHistory: DailyHistoryEntry[] = Array.from(historyMap.entries())
    .map(([date, v]) => ({
      date,
      km:    Math.round(v.km * 10) / 10,
      dPlus: Math.round(v.dPlus),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    weekKm: Math.round(weekKm * 10) / 10,
    weekDPlus: Math.round(weekDPlus),
    weekSessions,
    dailyKm,
    dailyDPlus,
    dailyDurationSec,
    dailyLabels,
    ytdKm,
    ytdDPlus,
    ytdSessions,
    monthlyKm,
    monthlyDPlus,
    atl: latest.atl,
    ctl: latest.ctl,
    tsb: latest.tsb,
    weekCes,
    last7Tsb,
    weeklyPoints,
    cumulMonths,
    cumulYears,
    workoutTypeBreakdown,
    dailyHistory,
  }
}

const HISTORY_PAGE_SIZE = 1000

async function fetchAllHistorySlim(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<SlimActivity[]> {
  const all: SlimActivity[] = []
  for (let from = 0; ; from += HISTORY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('activities')
      .select('sport_type, manual_sport_type, start_time, distance_m, elevation_gain_m, manual_distance_m, manual_elevation_gain_m')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('start_time', { ascending: true })
      .range(from, from + HISTORY_PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all.push(...(data as SlimActivity[]))
    if (data.length < HISTORY_PAGE_SIZE) break
  }
  return all
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient()

  const since = new Date()
  since.setDate(since.getDate() - EWMA_WARMUP_DAYS)

  const [{ data: rows }, yearActivities] = await Promise.all([
    supabase
      .from('activities')
      .select('id, sport_type, name, start_time, ces, avg_hr, distance_m, elevation_gain_m, moving_time_sec, manual_intensity, manual_sport_type, manual_workout_type, manual_distance_m, manual_elevation_gain_m, manual_moving_time_sec')
      .eq('user_id', userId)
      .gte('start_time', since.toISOString())
      .is('deleted_at', null)
      .order('start_time', { ascending: true }),
    fetchAllHistorySlim(supabase, userId),
  ])

  const activities = (rows ?? []) as ActivityRow[]

  const globalLoads = buildWindowedLoads(activities, EWMA_WARMUP_DAYS)
  const dailyMetrics = buildDailyMetrics(globalLoads).slice(-CHARGE_DISPLAY_DAYS)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentActivities = activities
    .filter((r) => new Date(r.start_time) >= sevenDaysAgo)
    .reverse()

  const now = new Date()
  const monday = mondayOfCurrentWeek()
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)
  const janFirst = new Date(now.getFullYear(), 0, 1)

  const sportOverviews: Record<SportKey, SportOverview> = {
    run:  buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.run,  monday, nextMonday, janFirst, now),
    ride: buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.ride, monday, nextMonday, janFirst, now),
    swim: buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.swim, monday, nextMonday, janFirst, now),
    all:  buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.all,  monday, nextMonday, janFirst, now),
  }

  const weekActivities = activities.filter((r) => {
    const t = new Date(r.start_time)
    return t >= monday && t < nextMonday
  })
  const sessionsByDay = new Map<number, { label: string; km: number; dPlus: number; dur: number }>()
  for (const a of weekActivities) {
    const dayIdx = toMonIndex(new Date(a.start_time).getDay())
    const km  = ((a.manual_distance_m       ?? a.distance_m)       ?? 0) / 1000
    const dp  = (a.manual_elevation_gain_m ?? a.elevation_gain_m) ?? 0
    const sec = (a.manual_moving_time_sec  ?? a.moving_time_sec)  ?? 0
    const existing = sessionsByDay.get(dayIdx)
    if (existing) {
      existing.km    += km
      existing.dPlus += dp
      existing.dur   += sec
      existing.label  = existing.label || a.name
    } else {
      sessionsByDay.set(dayIdx, { label: a.name, km, dPlus: dp, dur: sec })
    }
  }
  const weekSessions: DaySession[] = Array.from({ length: 7 }, (_, i) => {
    const s = sessionsByDay.get(i)
    return {
      day:         DAY_ABBR[i],
      label:       s?.label ?? '',
      volumeKm:    s ? Math.round(s.km * 10) / 10 : 0,
      dPlus:       s ? Math.round(s.dPlus) : 0,
      durationSec: s ? Math.round(s.dur) : 0,
    }
  })

  return {
    dailyMetrics,
    recentActivities,
    hasActivities: activities.length > 0,
    sportOverviews,
    weekSessions,
  }
}

