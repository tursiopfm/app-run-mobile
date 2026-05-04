import { cache } from 'react'
import { createClient } from '@/lib/database/supabase-server'
import { buildDailyMetrics, type DailyLoad, type DailyMetrics } from '@/lib/analytics/fatigue'

export type ActivityRow = {
  id: string
  sport_type: string
  name: string
  start_time: string
  ces: number | null
  distance_m: number | null
  elevation_gain_m: number | null
  moving_time_sec: number | null
}

export type DaySession = {
  day: string       // 'L' | 'M' | 'M' | 'J' | 'V' | 'S' | 'D'
  label: string     // session label or activity name
  volumeKm: number
  dPlus: number
}

export type WeekOverview = {
  runKm: number
  runDPlus: number
  runSessions: number
  dailyRunKm: number[]    // 7 values Mon[0]..Sun[6]
  dailyRunDPlus: number[] // 7 values Mon[0]..Sun[6]
}

export type YtdOverview = {
  runKm: number
  runDPlus: number
}

export type IntensityShare = {
  label: string
  km: number
}

export type WeeklyPoint = {
  weekLabel: string  // "DD/MM" — ISO Monday of the week
  km:        number
  dPlus:     number
}

export type MonthSeries = {
  label:      string    // e.g. "Jan 2025"
  color:      string    // hex
  dailyCumul: number[]  // cumulative km for days 1..N of that month
}

export type DashboardData = {
  dailyMetrics: DailyMetrics[]
  recentActivities: ActivityRow[]
  hasActivities: boolean
  weekOverview: WeekOverview
  monthlyRunKm: number[]   // 12 values Jan[0]..Dec[11]
  weekSessions: DaySession[]
  ytd: YtdOverview
  intensityBreakdown: IntensityShare[]
  weeklyPoints: WeeklyPoint[]  // last 10 ISO weeks, oldest first
  weekSuffer:   number         // sum of CES for current week
  cumulMonths:  MonthSeries[]  // last 4 calendar months
}

// Day abbreviations Mon..Sun (French, matching Android dayLabels)
const DAY_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// ISO week day to 0-based Mon index: Sun=6, Mon=0, Tue=1 … Sat=5
function toMonIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const jsDay = d.getDay()                    // 0=Sun..6=Sat
  const diff = jsDay === 0 ? -6 : 1 - jsDay  // shift back to Monday
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

function getIntensityLabel(ces: number): string {
  if (ces <= 30) return 'Footing'
  if (ces <= 60) return 'Sortie longue'
  if (ces <= 100) return 'Seuil'
  if (ces <= 150) return 'VMA'
  return 'Runtaf'
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

export const getDashboardData = cache(async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient()

  // Query 365 days for YTD + EWMA
  const yearAgo = new Date()
  yearAgo.setDate(yearAgo.getDate() - 365)

  const { data: rows } = await supabase
    .from('activities')
    .select('id, sport_type, name, start_time, ces, distance_m, elevation_gain_m, moving_time_sec')
    .eq('user_id', userId)
    .gte('start_time', yearAgo.toISOString())
    .order('start_time', { ascending: true })

  const activities = (rows ?? []) as ActivityRow[]

  // --- EWMA (use 60-day window for chart, 365-day data is fine for init) ---
  const loads = buildWindowedLoads(activities, 60)
  const dailyMetrics = buildDailyMetrics(loads)

  // --- Recent activities (last 7 days) ---
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentActivities = activities
    .filter((r) => new Date(r.start_time) >= sevenDaysAgo)
    .reverse()

  // --- Week overview (Mon–Sun of current week) ---
  const monday = mondayOfCurrentWeek()
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)

  const weekActivities = activities.filter((r) => {
    const t = new Date(r.start_time)
    return t >= monday && t < nextMonday
  })

  const dailyRunKm    = Array(7).fill(0) as number[]
  const dailyRunDPlus = Array(7).fill(0) as number[]
  let runKm = 0, runDPlus = 0, runSessions = 0

  for (const a of weekActivities) {
    const dayIdx = toMonIndex(new Date(a.start_time).getDay())
    const km = (a.distance_m ?? 0) / 1000
    const dp = a.elevation_gain_m ?? 0
    dailyRunKm[dayIdx]    += km
    dailyRunDPlus[dayIdx] += dp
    runKm      += km
    runDPlus   += dp
    runSessions++
  }

  const weekOverview: WeekOverview = {
    runKm: Math.round(runKm * 10) / 10,
    runDPlus: Math.round(runDPlus),
    runSessions,
    dailyRunKm,
    dailyRunDPlus,
  }

  // --- Week sessions for WeekTable ---
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

  // --- Weekly points (last 10 ISO weeks) ---
  const weekMap = new Map<string, { ts: number; km: number; dPlus: number }>()
  for (const a of activities) {
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

  const weekSuffer = Math.round(weekActivities.reduce((s, a) => s + (a.ces ?? 0), 0))

  // --- Cumulative km per month (last 4 calendar months) ---
  const MONTH_CUMUL_COLORS = ['#4ADE80', '#FF6B35', '#F87171', '#38BDF8']
  const MONTH_SHORT_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const nowDate = new Date()

  const monthActivityIndex = new Map<string, ActivityRow[]>()
  for (const a of activities) {
    const ad = new Date(a.start_time)
    const key = `${ad.getFullYear()}-${ad.getMonth()}`
    const arr = monthActivityIndex.get(key)
    if (arr) arr.push(a)
    else monthActivityIndex.set(key, [a])
  }

  const cumulMonths: MonthSeries[] = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - 3 + i, 1)
    const year  = d.getFullYear()
    const month = d.getMonth()
    const isCurrentMonth = year === nowDate.getFullYear() && month === nowDate.getMonth()
    const lastDay = isCurrentMonth ? nowDate.getDate() : new Date(year, month + 1, 0).getDate()

    const dailyKm = Array(lastDay).fill(0) as number[]
    const monthActivities = monthActivityIndex.get(`${year}-${month}`) ?? []
    for (const a of monthActivities) {
      const dayIdx = new Date(a.start_time).getDate() - 1
      if (dayIdx < lastDay) dailyKm[dayIdx] += (a.distance_m ?? 0) / 1000
    }

    const dailyCumul: number[] = []
    let cumul = 0
    for (let day = 0; day < lastDay; day++) {
      cumul += dailyKm[day]
      dailyCumul.push(Math.round(cumul * 10) / 10)
    }

    return { label: `${MONTH_SHORT_FR[month]} ${year}`, color: MONTH_CUMUL_COLORS[i], dailyCumul }
  })

  // --- YTD (Jan 1 of current year) ---
  const janFirst = new Date(new Date().getFullYear(), 0, 1)
  const ytdActivities = activities.filter((r) => new Date(r.start_time) >= janFirst)
  const ytd: YtdOverview = {
    runKm:    Math.round(ytdActivities.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0) * 10) / 10,
    runDPlus: Math.round(ytdActivities.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0)),
  }

  // --- Monthly km (Jan=0..Dec=11, current year only) ---
  const monthlyRunKm = Array(12).fill(0) as number[]
  for (const a of ytdActivities) {
    const month = new Date(a.start_time).getMonth() // 0..11
    monthlyRunKm[month] += (a.distance_m ?? 0) / 1000
  }
  for (let i = 0; i < 12; i++) {
    monthlyRunKm[i] = Math.round(monthlyRunKm[i] * 10) / 10
  }

  // --- Intensity breakdown (last 30 days) ---
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recent30 = activities.filter((r) => new Date(r.start_time) >= thirtyDaysAgo)

  const intensityMap = new Map<string, number>()
  for (const a of recent30) {
    if (!a.ces || !a.distance_m) continue
    const label = getIntensityLabel(a.ces)
    intensityMap.set(label, (intensityMap.get(label) ?? 0) + a.distance_m / 1000)
  }

  const intensityOrder = ['Footing', 'Sortie longue', 'Seuil', 'VMA', 'Runtaf']
  const intensityBreakdown: IntensityShare[] = intensityOrder
    .filter((l) => intensityMap.has(l))
    .map((l) => ({ label: l, km: Math.round((intensityMap.get(l) ?? 0) * 10) / 10 }))

  return {
    dailyMetrics,
    recentActivities,
    hasActivities: activities.length > 0,
    weekOverview,
    monthlyRunKm,
    weekSessions,
    ytd,
    intensityBreakdown,
    weeklyPoints,
    weekSuffer,
    cumulMonths,
  }
})
