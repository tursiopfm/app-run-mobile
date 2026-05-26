import { createClient } from '@/lib/database/supabase-server'
import { getChargePageData, type ChargePageData } from '@/lib/data/charge'

export type MorningLastActivity = {
  id:              string
  sportType:       string
  name:            string
  startTime:       string
  distanceMeters:  number | null
  movingTimeSec:   number | null
  elevationGainM:  number | null
  avgHr:           number | null
  ces:             number | null
}

export type MorningMonthlyVolume = { km: number; dPlus: number }

export type MorningWeekVolume = {
  km:    number
  dPlus: number
  byDay: number[]      // 7 entries, index 0 = Monday, 6 = Sunday
  todayIdx: number     // 0..6 index of today in byDay (Monday-based)
}

export type MorningTodaySession = {
  type:        string
  title:       string
  duration:    number          // minutes
  distance:    number | null   // km
  elevation:   number | null   // m
  status:      string
} | null

export type MorningReportData = {
  charge:         ChargePageData
  firstName:      string | null
  lastActivity:   MorningLastActivity | null
  monthlyVolume:  MorningMonthlyVolume
  weekVolume:     MorningWeekVolume
  todaySession:   MorningTodaySession
  generatedAt:    string
}

function startOfMonthLocal(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeekLocal(): Date {
  // Monday-based ISO week start
  const d = new Date()
  const dow = d.getDay()                       // 0 = Sun
  const daysSinceMonday = dow === 0 ? 6 : dow - 1
  d.setDate(d.getDate() - daysSinceMonday)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfTodayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function todayDateOnly(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dowToMondayIdx(dow: number): number {
  return dow === 0 ? 6 : dow - 1
}

export async function getMorningReportData(userId: string): Promise<MorningReportData> {
  const supabase = await createClient()

  const startOfMonthISO = startOfMonthLocal().toISOString()
  const startOfWeekISO  = startOfWeekLocal().toISOString()
  const startOfTodayISO = startOfTodayLocal().toISOString()
  const today           = todayDateOnly()

  const [charge, profileRes, lastActRes, monthRes, weekRes, todaySessionRes] = await Promise.all([
    getChargePageData(userId),
    supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('activities')
      .select('id, sport_type, name, start_time, distance_m, moving_time_sec, elevation_gain_m, avg_hr, ces')
      .eq('user_id', userId)
      .lt('start_time', startOfTodayISO)
      .order('start_time', { ascending: false })
      .limit(1),
    supabase
      .from('activities')
      .select('distance_m, elevation_gain_m, manual_distance_m, manual_elevation_gain_m')
      .eq('user_id', userId)
      .gte('start_time', startOfMonthISO),
    supabase
      .from('activities')
      .select('start_time, distance_m, elevation_gain_m, manual_distance_m, manual_elevation_gain_m')
      .eq('user_id', userId)
      .gte('start_time', startOfWeekISO),
    supabase
      .from('planned_sessions')
      .select('type, title, duration_min, distance_km, elevation_m, status, created_at')
      .eq('athlete_id', userId)
      .eq('date', today)
      .order('created_at', { ascending: true })
      .limit(1),
  ])

  if (lastActRes.error)      throw lastActRes.error
  if (monthRes.error)        throw monthRes.error
  if (weekRes.error)         throw weekRes.error
  if (todaySessionRes.error) throw todaySessionRes.error
  // profileRes errors are non-fatal — fall back to null first name

  const firstName: string | null = profileRes.data?.first_name ?? null

  const row = lastActRes.data?.[0]
  const lastActivity: MorningLastActivity | null = row ? {
    id:             row.id,
    sportType:      row.sport_type,
    name:           row.name,
    startTime:      row.start_time,
    distanceMeters: row.distance_m,
    movingTimeSec:  row.moving_time_sec,
    elevationGainM: row.elevation_gain_m,
    avgHr:          row.avg_hr,
    ces:            row.ces,
  } : null

  type AggRow = {
    distance_m: number | null
    elevation_gain_m: number | null
    manual_distance_m: number | null
    manual_elevation_gain_m: number | null
  }
  type WeekRow = AggRow & { start_time: string }

  const monthRows = (monthRes.data ?? []) as AggRow[]
  const monthAgg = monthRows.reduce(
    (acc, r) => {
      const dist  = r.manual_distance_m       ?? r.distance_m       ?? 0
      const dPlus = r.manual_elevation_gain_m ?? r.elevation_gain_m ?? 0
      return { km: acc.km + dist / 1000, dPlus: acc.dPlus + dPlus }
    },
    { km: 0, dPlus: 0 },
  )
  const monthlyVolume: MorningMonthlyVolume = {
    km:    Math.round(monthAgg.km),
    dPlus: Math.round(monthAgg.dPlus),
  }

  const weekRows = (weekRes.data ?? []) as WeekRow[]
  const byDay = [0, 0, 0, 0, 0, 0, 0]
  let weekKmAcc = 0
  let weekDPlusAcc = 0
  for (const r of weekRows) {
    const dist  = r.manual_distance_m       ?? r.distance_m       ?? 0
    const dPlus = r.manual_elevation_gain_m ?? r.elevation_gain_m ?? 0
    const dayIdx = dowToMondayIdx(new Date(r.start_time).getDay())
    byDay[dayIdx] += dist / 1000
    weekKmAcc += dist / 1000
    weekDPlusAcc += dPlus
  }
  const weekVolume: MorningWeekVolume = {
    km:    Math.round(weekKmAcc),
    dPlus: Math.round(weekDPlusAcc),
    byDay: byDay.map(v => Math.round(v * 10) / 10),
    todayIdx: dowToMondayIdx(new Date().getDay()),
  }

  const sessRow = todaySessionRes.data?.[0]
  const todaySession: MorningTodaySession = sessRow ? {
    type:      sessRow.type,
    title:     sessRow.title,
    duration:  sessRow.duration_min,
    distance:  sessRow.distance_km ?? null,
    elevation: sessRow.elevation_m ?? null,
    status:    sessRow.status,
  } : null

  return {
    charge,
    firstName,
    lastActivity,
    monthlyVolume,
    weekVolume,
    todaySession,
    generatedAt: new Date().toISOString(),
  }
}
