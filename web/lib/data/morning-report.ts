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

export type MorningReportData = {
  charge:        ChargePageData
  lastActivity:  MorningLastActivity | null
  generatedAt:   string
}

export async function getMorningReportData(userId: string): Promise<MorningReportData> {
  const supabase = await createClient()
  const [charge, lastActRes] = await Promise.all([
    getChargePageData(userId),
    supabase
      .from('activities')
      .select('id, sport_type, name, start_time, distance_m, moving_time_sec, elevation_gain_m, avg_hr, ces')
      .eq('athlete_id', userId)
      .order('start_time', { ascending: false })
      .limit(1),
  ])

  if (lastActRes.error) throw lastActRes.error

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

  return { charge, lastActivity, generatedAt: new Date().toISOString() }
}
