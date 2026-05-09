import { createClient } from '@/lib/database/supabase-server'
import { buildDailyMetrics, type DailyLoad, type DailyMetrics } from '@/lib/analytics/fatigue'
import { type SportKey, SPORT_TYPE_MAP } from '@/lib/design/sports'
import { calculateHrZones, hrZoneForAvgHr, type HrZone, type HrZoneMethod } from '@/lib/health/hr-zones'

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
}

export type DaySession = {
  day: string
  label: string
  volumeKm: number
  dPlus: number
}

export type SportOverview = {
  weekKm: number
  weekDPlus: number
  weekSessions: number
  dailyKm: number[]
  dailyDPlus: number[]
  dailyLabels: string[]
  ytdKm: number
  ytdDPlus: number
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
  intensityBreakdown: IntensityShare[]
}

type SlimActivity = {
  sport_type: string
  start_time: string
  distance_m: number | null
}

export type IntensityShare = {
  label: string
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
const MONTH_CUMUL_COLORS = ['#4ADE80', '#FF6B35', '#FACC15', '#38BDF8']
const MONTH_SHORT_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const INTENSITY_ORDER = ['Footing', 'Sortie longue', 'Seuil', 'VMA']

// ISO week day to 0-based Mon index: Sun=6, Mon=0, Tue=1 … Sat=5
function toMonIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
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

function intensityFromZone(zone: number): string {
  if (zone <= 2) return 'Footing'
  if (zone === 3) return 'Sortie longue'
  if (zone === 4) return 'Seuil'
  return 'VMA'
}

const MANUAL_TO_LABEL: Record<string, string> = {
  recuperation:     'Footing',
  footing:          'Footing',
  endurance_active: 'Sortie longue',
  sortie_longue:    'Sortie longue',
  cotes:            'Footing',
  vma:              'VMA',
  seuil:            'Seuil',
}

function getIntensityLabel(
  name: string,
  ces: number | null,
  avgHr: number | null,
  zones: HrZone[],
  manualIntensity?: string | null,
): string | null {
  if (manualIntensity) return MANUAL_TO_LABEL[manualIntensity] ?? null

  const n = name.toLowerCase()
  if (n.includes('footing') || n.includes(' ef ') || n.includes('endurance facile') || n.includes('récup'))
    return 'Footing'
  if (n.includes('sortie longue') || n.includes('sl ') || n.includes('long run') || n.includes('lsl'))
    return 'Sortie longue'
  if (n.includes('400') || n.includes('200') || n.includes('vma') || n.includes('interval')
      || n.includes('fractionné') || n.includes('répétition'))
    return 'VMA'
  if (n.includes('seuil') || n.includes('tempo') || n.includes('threshold'))
    return 'Seuil'

  if (avgHr != null && zones.length > 0) {
    const zone = hrZoneForAvgHr(avgHr, zones)
    if (zone !== null) return intensityFromZone(zone)
  }

  return null
}

function buildWindowedLoads(rows: ActivityRow[], days: number): DailyLoad[] {
  const loadMap = new Map<string, number>()
  for (const row of rows) {
    const date = row.start_time.slice(0, 10)
    loadMap.set(date, (loadMap.get(date) ?? 0) + (row.ces ?? 0))
  }
  const result: DailyLoad[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    result.push({ date, ces: loadMap.get(date) ?? 0 })
  }
  return result
}

function filterSport(activities: ActivityRow[], types: readonly string[] | null): ActivityRow[] {
  if (!types) return activities
  return activities.filter((a) => types.includes(a.sport_type))
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
    ? yearActivities.filter((a) => types.includes(a.sport_type))
    : yearActivities

  const byYear = new Map<number, SlimActivity[]>()
  for (const a of filtered) {
    const y = new Date(a.start_time).getFullYear()
    const arr = byYear.get(y)
    if (arr) arr.push(a)
    else byYear.set(y, [a])
  }

  const series: MonthSeries[] = []
  let colorIdx = 0
  const startYear = now.getFullYear() - 3
  const endYear = now.getFullYear()

  for (let y = startYear; y <= endYear; y++) {
    const yacts = byYear.get(y)
    if (!yacts || yacts.length === 0) continue

    const isCurrentYear = y === now.getFullYear()
    const totalDays = isCurrentYear
      ? dayOfYearIdx(now) + 1
      : isLeapYear(y) ? 366 : 365

    const dayKm = Array(totalDays).fill(0) as number[]
    for (const a of yacts) {
      const ad = new Date(a.start_time)
      const idx = dayOfYearIdx(ad)
      if (idx >= 0 && idx < totalDays) dayKm[idx] += (a.distance_m ?? 0) / 1000
    }

    const dailyCumul: number[] = []
    let cumul = 0
    for (let d = 0; d < totalDays; d++) {
      cumul += dayKm[d]
      dailyCumul.push(Math.round(cumul * 10) / 10)
    }

    series.push({
      label: String(y),
      color: MONTH_CUMUL_COLORS[colorIdx % MONTH_CUMUL_COLORS.length],
      dailyCumul,
    })
    colorIdx++
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
  hrZones: HrZone[],
): SportOverview {
  const acts = filterSport(all365, types)

  const weekActs = acts.filter((a) => {
    const t = new Date(a.start_time)
    return t >= monday && t < nextMonday
  })
  const dailyKm     = Array(7).fill(0) as number[]
  const dailyDPlus  = Array(7).fill(0) as number[]
  const dailyLabels = Array(7).fill('') as string[]
  let weekKm = 0, weekDPlus = 0, weekSessions = 0
  for (const a of weekActs) {
    const idx = toMonIndex(new Date(a.start_time).getDay())
    const km  = (a.distance_m ?? 0) / 1000
    const dp  = a.elevation_gain_m ?? 0
    dailyKm[idx]    += km
    dailyDPlus[idx] += dp
    if (!dailyLabels[idx]) dailyLabels[idx] = a.name
    weekKm    += km
    weekDPlus += dp
    weekSessions++
  }
  const weekCes = Math.round(weekActs.reduce((s, a) => s + (a.ces ?? 0), 0))

  const ytdActs = acts.filter((a) => new Date(a.start_time) >= janFirst)
  const ytdKm    = Math.round(ytdActs.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0) * 10) / 10
  const ytdDPlus = Math.round(ytdActs.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0))
  const monthlyKm   = Array(12).fill(0) as number[]
  const monthlyDPlus = Array(12).fill(0) as number[]
  for (const a of ytdActs) {
    const mo = new Date(a.start_time).getMonth()
    monthlyKm[mo]   += (a.distance_m    ?? 0) / 1000
    monthlyDPlus[mo] += (a.elevation_gain_m ?? 0)
  }
  for (let i = 0; i < 12; i++) {
    monthlyKm[i]   = Math.round(monthlyKm[i] * 10) / 10
    monthlyDPlus[i] = Math.round(monthlyDPlus[i])
  }

  const loads   = buildWindowedLoads(acts, 60)
  const metrics = buildDailyMetrics(loads)
  const latest  = metrics[metrics.length - 1] ?? { atl: 0, ctl: 0, tsb: 0 }
  const last7Tsb = metrics.slice(-7).map((m) => m.tsb)

  // Weekly points (last 10 weeks)
  const weekMap = new Map<string, { ts: number; km: number; dPlus: number }>()
  for (const a of acts) {
    const ws = getWeekStart(new Date(a.start_time))
    const isoKey = ws.toISOString().slice(0, 10)
    const entry = weekMap.get(isoKey) ?? { ts: ws.getTime(), km: 0, dPlus: 0 }
    entry.km    += (a.distance_m       ?? 0) / 1000
    entry.dPlus += (a.elevation_gain_m ?? 0)
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
      if (dayIdx < lastDay) dayKm[dayIdx] += (a.distance_m ?? 0) / 1000
    }
    const dailyCumul: number[] = []
    let cumul = 0
    for (let day = 0; day < lastDay; day++) {
      cumul += dayKm[day]
      dailyCumul.push(Math.round(cumul * 10) / 10)
    }
    return { label: `${MONTH_SHORT_FR[month]} ${year}`, color: MONTH_CUMUL_COLORS[i], dailyCumul }
  })

  // Intensity breakdown (last 30 days)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const intensityMap = new Map<string, number>()
  for (const a of acts.filter((r) => new Date(r.start_time) >= thirtyDaysAgo)) {
    if (!a.distance_m) continue
    const label = getIntensityLabel(a.name, a.ces, a.avg_hr, hrZones, a.manual_intensity)
    if (!label) continue
    intensityMap.set(label, (intensityMap.get(label) ?? 0) + a.distance_m / 1000)
  }
  const intensityBreakdown: IntensityShare[] = INTENSITY_ORDER
    .filter((l) => intensityMap.has(l))
    .map((l) => ({ label: l, km: Math.round((intensityMap.get(l) ?? 0) * 10) / 10 }))

  const cumulYears = buildCumulYears(yearActivities, types, now)

  return {
    weekKm: Math.round(weekKm * 10) / 10,
    weekDPlus: Math.round(weekDPlus),
    weekSessions,
    dailyKm,
    dailyDPlus,
    dailyLabels,
    ytdKm,
    ytdDPlus,
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
    intensityBreakdown,
  }
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient()

  const yearAgo = new Date()
  yearAgo.setDate(yearAgo.getDate() - 365)

  const fourYearsAgo = new Date(new Date().getFullYear() - 3, 0, 1)

  const [{ data: rows }, { data: yearRows }, { data: profile }] = await Promise.all([
    supabase
      .from('activities')
      .select('id, sport_type, name, start_time, ces, avg_hr, distance_m, elevation_gain_m, moving_time_sec, manual_intensity')
      .eq('user_id', userId)
      .gte('start_time', yearAgo.toISOString())
      .is('deleted_at', null)
      .order('start_time', { ascending: true }),
    supabase
      .from('activities')
      .select('sport_type, start_time, distance_m')
      .eq('user_id', userId)
      .gte('start_time', fourYearsAgo.toISOString())
      .is('deleted_at', null)
      .order('start_time', { ascending: true }),
    supabase
      .from('profiles')
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year')
      .eq('id', userId)
      .single(),
  ])

  const activities = (rows ?? []) as ActivityRow[]
  const yearActivities = (yearRows ?? []) as SlimActivity[]

  const hrZones: HrZone[] = (() => {
    if (!profile) return []
    const p = profile as Record<string, number | null>
    let method: HrZoneMethod = 'auto'
    if (p.max_hr && p.aerobic_threshold_hr && p.threshold_hr) method = 'seuils'
    else if (p.max_hr && p.threshold_hr) method = 'test30'
    else if (p.max_hr && p.resting_hr) method = 'karvonen'
    else if (p.max_hr) method = 'pct_max'
    return calculateHrZones({
      method,
      maxHr:              p.max_hr,
      restingHr:          p.resting_hr,
      aerobicThresholdHr: p.aerobic_threshold_hr,
      thresholdHr:        p.threshold_hr,
      birthYear:          p.birth_year,
    }).zones
  })()

  const globalLoads = buildWindowedLoads(activities, 60)
  const dailyMetrics = buildDailyMetrics(globalLoads)

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
    run:  buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.run,  monday, nextMonday, janFirst, now, hrZones),
    ride: buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.ride, monday, nextMonday, janFirst, now, hrZones),
    swim: buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.swim, monday, nextMonday, janFirst, now, hrZones),
    all:  buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.all,  monday, nextMonday, janFirst, now, hrZones),
  }

  const weekActivities = activities.filter((r) => {
    const t = new Date(r.start_time)
    return t >= monday && t < nextMonday
  })
  const sessionsByDay = new Map<number, { label: string; km: number; dPlus: number }>()
  for (const a of weekActivities) {
    const dayIdx = toMonIndex(new Date(a.start_time).getDay())
    const km = (a.distance_m ?? 0) / 1000
    const dp = a.elevation_gain_m ?? 0
    const existing = sessionsByDay.get(dayIdx)
    if (existing) {
      existing.km    += km
      existing.dPlus += dp
      existing.label  = existing.label || a.name
    } else {
      sessionsByDay.set(dayIdx, { label: a.name, km, dPlus: dp })
    }
  }
  const weekSessions: DaySession[] = Array.from({ length: 7 }, (_, i) => {
    const s = sessionsByDay.get(i)
    return {
      day:      DAY_ABBR[i],
      label:    s?.label ?? '',
      volumeKm: s ? Math.round(s.km * 10) / 10 : 0,
      dPlus:    s ? Math.round(s.dPlus) : 0,
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

