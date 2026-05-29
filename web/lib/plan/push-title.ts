// Push automatique du titre d'une séance planifiée sur Strava quand une nouvelle
// activité matche la séance (1↔1) à l'arrivée via webhook.
//
// Déclencheur : POST webhook Strava (cf. web/app/api/strava/webhook/route.ts).
// Best-effort : toutes les erreurs sont avalées (retour { pushed: false, reason })
// — ce helper ne doit JAMAIS faire échouer le webhook.

import { updateStravaActivityName } from '@/lib/providers/strava/api'
import {
  matchSessionsToActivities,
  type MatchableActivity,
} from '@/lib/plan/session-matching'
import type { PlannedSession } from '@/types/plan'
import type { ActivityType } from '@/types/activity-types'

// Structurellement compatible avec @supabase/supabase-js (service role + SSR).
export type SupabaseLike = {
  from: (table: string) => any
}

export type MaybePushParams = {
  supabase: SupabaseLike
  userId: string
  accessToken: string
  newActivityId: string  // uuid interne de l'activité fraîchement upsert
}

export type MaybePushResult = {
  pushed: boolean
  reason?: string
}

type ActivityRow = {
  id: string
  provider_activity_id: string | null
  start_time: string
  sport_type: string | null
  manual_sport_type: string | null
  distance_m: number | null
  manual_distance_m: number | null
  elevation_gain_m: number | null
  manual_elevation_gain_m: number | null
}

type PlannedSessionRow = {
  id: string
  plan_id: string | null
  date: string
  type: string
  title: string | null
  duration_min: number
  distance_km: number | null
  elevation_m: number | null
  intensity: number
  estimated_charge: number
  zones: unknown
  notes: string | null
  status: string
  linked_activity_id: string | null
  template_id: string | null
}

type ActivityTypeRow = {
  id: string
  slug: string
  label: string
  default_intensity: number
  category: string | null
  is_system: boolean
}

// Bornes UTC de la semaine ISO contenant `d` (lundi 00:00 inclus → lundi suivant exclu).
function isoWeekBoundsUtc(d: Date): { start: Date; end: Date } {
  const day = d.getUTCDay() // 0 = dim, 1 = lun, …
  const offsetToMonday = day === 0 ? 6 : day - 1
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - offsetToMonday)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  return { start, end }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rowToMatchable(row: ActivityRow): MatchableActivity {
  const sport = row.manual_sport_type ?? row.sport_type ?? ''
  const distM = row.manual_distance_m ?? row.distance_m ?? 0
  const elevM = row.manual_elevation_gain_m ?? row.elevation_gain_m ?? 0
  return {
    id: row.id,
    date: (row.start_time ?? '').slice(0, 10),
    sportType: sport,
    distanceKm: distM / 1000,
    elevationM: elevM,
  }
}

function rowToPlannedSession(row: PlannedSessionRow): PlannedSession {
  return {
    id: row.id,
    planId: row.plan_id ?? '',
    date: row.date,
    type: row.type,
    title: row.title ?? '',
    duration: row.duration_min,
    distance: row.distance_km ?? undefined,
    elevation: row.elevation_m ?? undefined,
    // intensity / status sont validés en base par CHECK constraints (cf. 014_plan.sql)
    intensity: row.intensity as 1 | 2 | 3 | 4 | 5,
    estimatedCharge: row.estimated_charge,
    status: row.status as PlannedSession['status'],
    linkedActivityId: row.linked_activity_id ?? undefined,
    templateId: row.template_id ?? undefined,
  }
}

function rowToActivityType(row: ActivityTypeRow): ActivityType {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    defaultIntensity: row.default_intensity as 1 | 2 | 3 | 4 | 5,
    category: (row.category ?? undefined) as ActivityType['category'],
    isSystem: row.is_system,
  }
}

export async function maybePushPlanTitleToStrava(
  params: MaybePushParams
): Promise<MaybePushResult> {
  const { supabase, userId, accessToken, newActivityId } = params
  try {
    // 1. Préférence user
    const profileRes = await supabase
      .from('profiles')
      .select('plan_auto_push_title')
      .eq('id', userId)
      .single()
    if (profileRes.error) return { pushed: false, reason: `error: profile ${profileRes.error.message ?? ''}` }
    if (profileRes.data?.plan_auto_push_title === false) {
      return { pushed: false, reason: 'pref_off' }
    }

    // 2. Activité fraîchement upsert
    const newActRes = await supabase
      .from('activities')
      .select(
        'id, provider_activity_id, start_time, sport_type, manual_sport_type, ' +
        'distance_m, manual_distance_m, elevation_gain_m, manual_elevation_gain_m'
      )
      .eq('id', newActivityId)
      .single()
    if (newActRes.error || !newActRes.data) {
      return { pushed: false, reason: 'activity_missing' }
    }
    const newRow = newActRes.data as ActivityRow

    if (!newRow.provider_activity_id) {
      return { pushed: false, reason: 'no_provider_id' }
    }
    if (!newRow.start_time) {
      return { pushed: false, reason: 'no_start_time' }
    }

    // 3. Fenêtre semaine ISO (lundi 00:00 UTC → lundi suivant 00:00 UTC)
    const { start: weekStart, end: weekEnd } = isoWeekBoundsUtc(new Date(newRow.start_time))
    const weekStartIso  = weekStart.toISOString()
    const weekEndIso    = weekEnd.toISOString()
    const weekStartDate = toIsoDate(weekStart)
    // dimanche = lundi suivant - 1 jour, pour le filtre planned_sessions.date <= sunday
    const sunday = new Date(weekEnd); sunday.setUTCDate(sunday.getUTCDate() - 1)
    const weekEndDate = toIsoDate(sunday)

    // 4. Activités de la semaine (incluant la nouvelle)
    const actsRes = await supabase
      .from('activities')
      .select(
        'id, start_time, sport_type, manual_sport_type, ' +
        'distance_m, manual_distance_m, elevation_gain_m, manual_elevation_gain_m'
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('start_time', weekStartIso)
      .lt('start_time', weekEndIso)
    if (actsRes.error) return { pushed: false, reason: `error: activities ${actsRes.error.message ?? ''}` }
    const activities = (actsRes.data ?? []).map(rowToMatchable) as MatchableActivity[]

    // 5. Séances planifiées de la semaine (FK athlete_id, cf. migration 014)
    const sessRes = await supabase
      .from('planned_sessions')
      .select(
        'id, plan_id, date, type, title, duration_min, distance_km, elevation_m, ' +
        'intensity, estimated_charge, zones, notes, status, linked_activity_id, template_id'
      )
      .eq('athlete_id', userId)
      .gte('date', weekStartDate)
      .lte('date', weekEndDate)
    if (sessRes.error) return { pushed: false, reason: `error: sessions ${sessRes.error.message ?? ''}` }
    const sessions = (sessRes.data ?? []).map(rowToPlannedSession) as PlannedSession[]
    if (sessions.length === 0) return { pushed: false, reason: 'no_sessions' }

    // 6. Catalogue activity_types (système + custom user, cf. RLS migration 018)
    const catRes = await supabase
      .from('activity_types')
      .select('id, slug, label, default_intensity, category, is_system')
    if (catRes.error) return { pushed: false, reason: `error: catalog ${catRes.error.message ?? ''}` }
    const catalog = (catRes.data ?? []).map(rowToActivityType) as ActivityType[]

    // 7. Matching (paires déliées LS non connues côté serveur → undefined)
    const matches = matchSessionsToActivities(sessions, activities, catalog, undefined)

    // 8. Cherche une entrée 1↔1 incluant la nouvelle activité
    let matchedSession: PlannedSession | null = null
    const entries = Array.from(matches.entries())
    for (const [sessionId, actIds] of entries) {
      if (actIds.length !== 1) continue
      if (actIds[0] !== newActivityId) continue
      matchedSession = sessions.find(s => s.id === sessionId) ?? null
      break
    }
    if (!matchedSession) return { pushed: false, reason: 'no_match_1to1' }

    // 9. Titre non vide
    const title = (matchedSession.title ?? '').trim()
    if (title === '') return { pushed: false, reason: 'empty_title' }

    // 10. Push Strava
    await updateStravaActivityName(
      accessToken,
      Number(newRow.provider_activity_id),
      matchedSession.title
    )
    return { pushed: true }
  } catch (err) {
    return { pushed: false, reason: `error: ${String(err)}` }
  }
}
