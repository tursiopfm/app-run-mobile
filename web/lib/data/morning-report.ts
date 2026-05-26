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

// ─── Timezone helpers ───
// Toutes les notions "aujourd'hui", "ce mois", "cette semaine" sont calculées
// dans la timezone de l'utilisateur (par défaut Europe/Paris).
// Vercel tourne en UTC ; sans ce calcul, "aujourd'hui" serait le jour UTC,
// pas le jour local de l'athlète — bug entre 00:00 et ~02:00 heure de Paris.

const DEFAULT_TZ = 'Europe/Paris'

function tzOffsetMs(timeZone: string, when: Date): number {
  // Renvoie l'offset (en ms) entre UTC et `timeZone` à l'instant `when`.
  // Astuce : on formate `when` en string locale dans les deux tz puis on
  // re-parse — la différence reflète l'offset, indépendamment de la tz du host.
  const utcStr = when.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr  = when.toLocaleString('en-US', { timeZone })
  return new Date(tzStr).getTime() - new Date(utcStr).getTime()
}

type TzDate = { y: number; m: number; d: number; dow: number; ymd: string }

function tzShifted(timeZone: string, when: Date): TzDate {
  // Renvoie les composantes Y/M/D/dow du moment `when` vu dans `timeZone`.
  const offset = tzOffsetMs(timeZone, when)
  const t = new Date(when.getTime() + offset)
  const y = t.getUTCFullYear()
  const m = t.getUTCMonth() + 1
  const d = t.getUTCDate()
  const dow = t.getUTCDay()
  const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { y, m, d, dow, ymd }
}

function startOfTzDayISO(timeZone: string, year: number, month: number, day: number): string {
  // Instant UTC correspondant à 00:00 local dans `timeZone` à la date donnée.
  // Probe à midi UTC pour éviter les bords de transition DST.
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const offset = tzOffsetMs(timeZone, probe)
  return new Date(Date.UTC(year, month - 1, day) - offset).toISOString()
}

function dowToMondayIdx(dow: number): number {
  return dow === 0 ? 6 : dow - 1
}

export async function getMorningReportData(
  userId:   string,
  timeZone: string = DEFAULT_TZ,
): Promise<MorningReportData> {
  const supabase = await createClient()

  const now    = new Date()
  const today  = tzShifted(timeZone, now)
  const startOfTodayISO = startOfTzDayISO(timeZone, today.y, today.m, today.d)
  const startOfMonthISO = startOfTzDayISO(timeZone, today.y, today.m, 1)

  const daysSinceMonday = dowToMondayIdx(today.dow)
  const mondayMs        = Date.UTC(today.y, today.m - 1, today.d) - daysSinceMonday * 86400000
  const monday          = new Date(mondayMs)
  const startOfWeekISO  = startOfTzDayISO(
    timeZone,
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
  )

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
      .select('sport_type, manual_sport_type, distance_m, elevation_gain_m, manual_distance_m, manual_elevation_gain_m')
      .eq('user_id', userId)
      .gte('start_time', startOfMonthISO),
    supabase
      .from('activities')
      .select('sport_type, manual_sport_type, start_time, distance_m, elevation_gain_m, manual_distance_m, manual_elevation_gain_m')
      .eq('user_id', userId)
      .gte('start_time', startOfWeekISO),
    supabase
      .from('planned_sessions')
      .select('type, title, duration_min, distance_km, elevation_m, status, created_at')
      .eq('athlete_id', userId)
      .eq('date', today.ymd)
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
    sport_type: string
    manual_sport_type: string | null
    distance_m: number | null
    elevation_gain_m: number | null
    manual_distance_m: number | null
    manual_elevation_gain_m: number | null
  }
  type WeekRow = AggRow & { start_time: string }

  const RUN_SPORT_TYPES = new Set(['Run', 'TrailRun'])
  function isRun(r: { sport_type: string; manual_sport_type: string | null }): boolean {
    return RUN_SPORT_TYPES.has(r.manual_sport_type ?? r.sport_type)
  }

  const monthRows = ((monthRes.data ?? []) as AggRow[]).filter(isRun)
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

  const weekRows = ((weekRes.data ?? []) as WeekRow[]).filter(isRun)
  const byDay = [0, 0, 0, 0, 0, 0, 0]
  let weekKmAcc = 0
  let weekDPlusAcc = 0
  for (const r of weekRows) {
    const dist  = r.manual_distance_m       ?? r.distance_m       ?? 0
    const dPlus = r.manual_elevation_gain_m ?? r.elevation_gain_m ?? 0
    const activityTz = tzShifted(timeZone, new Date(r.start_time))
    const dayIdx = dowToMondayIdx(activityTz.dow)
    byDay[dayIdx] += dist / 1000
    weekKmAcc += dist / 1000
    weekDPlusAcc += dPlus
  }
  const weekVolume: MorningWeekVolume = {
    km:    Math.round(weekKmAcc),
    dPlus: Math.round(weekDPlusAcc),
    byDay: byDay.map(v => Math.round(v * 10) / 10),
    todayIdx: dowToMondayIdx(today.dow),
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
