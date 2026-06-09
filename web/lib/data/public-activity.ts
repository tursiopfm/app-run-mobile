import { cache } from 'react'
import { createServiceClient } from '@/lib/database/supabase-server'
import { unpackStreams } from '@/lib/providers/strava/streams'
import type { ActivityDetail } from '@/app/(public)/activities/[id]/ActivityDetailClient'
import type { StravaSplit, StravaLap } from '@/lib/activities/detail'

export type PublicAthleteProfile = {
  max_hr: number | null
  resting_hr: number | null
  aerobic_threshold_hr: number | null
  threshold_hr: number | null
  birth_year: number | null
  hr_zone_method: string | null
  hr_zones_custom: { zone: number; min: number | null; max: number | null }[] | null
}

export type PublicActivity = {
  activity: ActivityDetail
  ownerId: string
  splits: StravaSplit[] | null
  laps: StravaLap[] | null
  athleteProfile: PublicAthleteProfile | null
  hrStream: { heartrate: number[]; time: number[] } | null
}

const ACTIVITY_COLS =
  'id, user_id, sport_type, manual_sport_type, name, start_time, ces, manual_intensity, manual_workout_type, distance_m, manual_distance_m, elevation_gain_m, manual_elevation_gain_m, moving_time_sec, manual_moving_time_sec, duration_sec, avg_hr, max_hr, calories, raw_payload, provider, provider_activity_id'

// Cache par requête (React cache) : metadata + page partagent un seul fetch.
export const getPublicActivity = cache(async (id: string): Promise<PublicActivity | null> => {
  const supabase = createServiceClient()

  const { data: row } = await supabase
    .from('activities')
    .select(ACTIVITY_COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!row) return null

  const { user_id: ownerId, ...rest } = row as Record<string, unknown> & { user_id: string }
  const activity = rest as unknown as ActivityDetail

  // splits / laps : uniquement depuis raw_payload (jamais d'appel Strava ici)
  const rawPayload = (activity.raw_payload ?? null) as Record<string, unknown> | null
  const rawSplits = rawPayload?.splits_metric
  const rawLaps = rawPayload?.laps
  const splits = Array.isArray(rawSplits) ? (rawSplits as unknown as StravaSplit[]) : null
  const laps = Array.isArray(rawLaps) ? (rawLaps as unknown as StravaLap[]) : null

  // Profil FC du propriétaire (zones FC) + courbe FC : requêtes indépendantes,
  // lancées en parallèle. La courbe n'est lue que si l'activité a une FC.
  const [{ data: profile }, { data: streamRow }] = await Promise.all([
    supabase
      .from('profiles')
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, hr_zone_method, hr_zones_custom')
      .eq('id', ownerId)
      .maybeSingle(),
    activity.avg_hr
      ? supabase.from('activity_streams').select('streams_gz').eq('activity_id', id).maybeSingle()
      : Promise.resolve({ data: null as { streams_gz?: unknown } | null }),
  ])

  let hrStream: { heartrate: number[]; time: number[] } | null = null
  if (streamRow?.streams_gz) {
    try {
      const s = unpackStreams(String(streamRow.streams_gz))
      if (s.heartrate?.length && s.time?.length) hrStream = { heartrate: s.heartrate, time: s.time }
    } catch { /* stream corrompu → fallback estimation côté client */ }
  }

  return {
    activity,
    ownerId,
    splits,
    laps,
    athleteProfile: (profile ?? null) as PublicAthleteProfile | null,
    hrStream,
  }
})
