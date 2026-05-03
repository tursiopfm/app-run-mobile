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

export type DashboardData = {
  dailyMetrics: DailyMetrics[]
  recentActivities: ActivityRow[]
  hasActivities: boolean
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

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient()

  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const { data: rows } = await supabase
    .from('activities')
    .select('id, sport_type, name, start_time, ces, distance_m, elevation_gain_m, moving_time_sec')
    .eq('user_id', userId)
    .gte('start_time', sixtyDaysAgo.toISOString())
    .order('start_time', { ascending: true })

  const activities = (rows ?? []) as ActivityRow[]
  const loads = buildWindowedLoads(activities, 60)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentActivities = activities
    .filter((r) => new Date(r.start_time) >= sevenDaysAgo)
    .reverse()

  return {
    dailyMetrics: buildDailyMetrics(loads),
    recentActivities,
    hasActivities: activities.length > 0,
  }
}
