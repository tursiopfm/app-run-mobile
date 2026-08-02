import { createServiceClient } from '@/lib/database/supabase-server'
import {
  CHARGE_ACTIVITY_COLUMNS, CHARGE_PROFILE_COLUMNS, computeAllSportPayload,
} from '@/lib/data/charge'
import { EWMA_WARMUP_DAYS } from '@/lib/analytics/charge-insights'
import type { StatusId } from '@/lib/analytics/charge-insights.types'
import type { TodaySessionLite } from './morning-message'

export type MorningPushData = {
  status:  StatusId
  session: TodaySessionLite | null
}

// Lecture en service role : le cron n'a pas de session utilisateur. On charge
// ~1 an d'activités pour amorcer l'EWMA, comme getChargePageData, mais on ne
// calcule que le payload « all ».
export async function getMorningPushData(
  userId:   string,
  todayYmd: string,
  now:      Date,
): Promise<MorningPushData> {
  const supabase = createServiceClient()
  const since = new Date(now)
  since.setDate(since.getDate() - EWMA_WARMUP_DAYS)

  const [actsRes, profRes, sessRes] = await Promise.all([
    supabase.from('activities')
      .select(CHARGE_ACTIVITY_COLUMNS)
      .eq('user_id', userId)
      .gte('start_time', since.toISOString())
      .is('deleted_at', null)
      .order('start_time', { ascending: true }),
    supabase.from('profiles')
      .select(CHARGE_PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle(),
    supabase.from('planned_sessions')
      .select('title, duration_min, distance_km')
      .eq('athlete_id', userId)
      .eq('date', todayYmd)
      .order('created_at', { ascending: true })
      .limit(1),
  ])

  const payload = computeAllSportPayload(
    actsRes.data ?? [],
    (profRes.data ?? null) as Record<string, number | null> | null,
    now,
  )

  const row = sessRes.data?.[0] as
    { title: string; duration_min: number; distance_km: number | null } | undefined

  return {
    status:  payload.insights.status,
    session: row
      ? { title: row.title, duration: row.duration_min, distance: row.distance_km }
      : null,
  }
}
