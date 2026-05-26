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

export type MorningReportData = {
  charge:         ChargePageData
  lastActivity:   MorningLastActivity | null
  monthlyVolume:  MorningMonthlyVolume
  generatedAt:    string
}

export async function getMorningReportData(userId: string): Promise<MorningReportData> {
  const supabase = await createClient()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const startOfMonthISO = startOfMonth.toISOString()

  const [charge, lastActRes, monthRes] = await Promise.all([
    getChargePageData(userId),
    supabase
      .from('activities')
      .select('id, sport_type, name, start_time, distance_m, moving_time_sec, elevation_gain_m, avg_hr, ces')
      .eq('athlete_id', userId)
      .order('start_time', { ascending: false })
      .limit(1),
    supabase
      .from('activities')
      .select('distance_m, elevation_gain_m, manual_distance_m, manual_elevation_gain_m')
      .eq('athlete_id', userId)
      .gte('start_time', startOfMonthISO),
  ])

  if (lastActRes.error) throw lastActRes.error
  if (monthRes.error)   throw monthRes.error

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

  type MonthRow = {
    distance_m: number | null
    elevation_gain_m: number | null
    manual_distance_m: number | null
    manual_elevation_gain_m: number | null
  }

  const monthRows = (monthRes.data ?? []) as MonthRow[]
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

  return { charge, lastActivity, monthlyVolume, generatedAt: new Date().toISOString() }
}
