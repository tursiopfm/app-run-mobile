// web/lib/garmin-import/commit.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeCesResult } from '@/lib/analytics/effort-score'
import type { UserProfileForCes, ActivityInput, CesStreamMetrics } from '@/lib/analytics/types'
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import type { GarminMapped, DedupClassification, ImportReport } from './types'

function toActivityInput(act: NormalizedActivity): ActivityInput {
  return {
    id: act.providerActivityId,
    rawSportType: act.sportType,
    name: act.name,
    startDate: act.startTime,
    movingTimeSeconds: act.movingTimeSec,
    elapsedTimeSeconds: act.durationSec,
    distanceMeters: act.distanceM,
    elevationGainMeters: act.elevationGainM,
    averageHeartrate: act.avgHr ?? undefined,
    maxHeartrate: act.maxHr ?? undefined,
    calories: act.calories ?? undefined,
  }
}

function activityRow(userId: string, m: GarminMapped) {
  const sm: CesStreamMetrics | undefined =
    m.elevationLossM != null ? { gradeAdjustedPaceS: null, decouplingPct: null, elevationLossM: m.elevationLossM } : undefined
  const ces = computeCesResult(toActivityInput(m.normalized), {} as UserProfileForCes, sm)
  return { ces, sm, row: {
    user_id: userId,
    provider: 'garmin',
    provider_activity_id: m.normalized.providerActivityId,
    sport_type: m.normalized.sportType,
    name: m.normalized.name,
    start_time: m.normalized.startTime,
    duration_sec: m.normalized.durationSec,
    moving_time_sec: m.normalized.movingTimeSec,
    distance_m: m.normalized.distanceM,
    elevation_gain_m: m.normalized.elevationGainM,
    avg_hr: m.normalized.avgHr,
    max_hr: m.normalized.maxHr,
    avg_power: null,
    calories: m.normalized.calories,
    external_training_load: null,
    ces: ces.ces,
    effort_score_version: ces.version,
    effort_score_updated_at: new Date().toISOString(),
    raw_payload: m.normalized.rawPayload,
  } }
}

/** Recompute le CES avec le profil utilisateur fourni (chargé par la route). */
function withProfile(userId: string, m: GarminMapped, profile: UserProfileForCes) {
  const built = activityRow(userId, m)
  const sm = built.sm
  const ces = computeCesResult(toActivityInput(m.normalized), profile, sm)
  return { ces, row: { ...built.row, ces: ces.ces } }
}

async function insertActivitiesWithMetrics(
  supabase: SupabaseClient, userId: string, items: GarminMapped[], profile: UserProfileForCes,
): Promise<number> {
  if (items.length === 0) return 0
  let saved = 0
  // Batch volontairement petit : un export GDPR contient de gros raw_payload JSONB ;
  // au-delà, l'upsert dépasse le statement_timeout Supabase → la fonction Vercel hange
  // ~8 s → crash. L'upsert est idempotent, donc un retry reprend sans créer de doublon.
  const BATCH = 50
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH)
    const built = slice.map(m => withProfile(userId, m, profile))
    const { data, error } = await supabase
      .from('activities')
      .upsert(built.map(b => b.row), { onConflict: 'user_id,provider,provider_activity_id' })
      .select('id, provider_activity_id')
    if (error) throw new Error(`Garmin activity upsert: ${error.message}`)
    const rows = (data ?? []) as { id: string; provider_activity_id: string }[]
    const cesById = new Map(built.map(b => [b.row.provider_activity_id, b.ces]))
    const metricRows = rows.flatMap(r => {
      const ces = cesById.get(r.provider_activity_id)!
      const base = [
        { activity_id: r.id, metric_key: 'ces', metric_value: ces.ces },
        { activity_id: r.id, metric_key: 'cardio_load', metric_value: ces.cardioLoad },
        { activity_id: r.id, metric_key: 'muscle_load', metric_value: ces.muscleLoad },
        { activity_id: r.id, metric_key: 'intensity_factor', metric_value: ces.intensityFactor },
      ]
      return base
    })
    if (metricRows.length) {
      const { error: mErr } = await supabase.from('activity_metrics').upsert(metricRows, { onConflict: 'activity_id,metric_key' })
      if (mErr) throw new Error(`Garmin metrics upsert: ${mErr.message}`)
    }
    saved += rows.length
  }
  return saved
}

export async function commitGarminImport(
  supabase: SupabaseClient,
  userId: string,
  classification: DedupClassification,
  profile: UserProfileForCes,
): Promise<ImportReport> {
  const replacements = classification.conflits.filter(c => c.decision === 'replace_garmin')
  const keptStrava = classification.conflits.length - replacements.length

  // Soft-delete des lignes remplacées AVANT insert (garantit une seule ligne active).
  // En UN SEUL statement (`.in`) au lieu d'une boucle par activité → évite le timeout
  // de fonction quand il y a beaucoup de remplacements.
  if (replacements.length) {
    const ids = replacements.map(r => r.existing.id)
    const { error } = await supabase
      .from('activities')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
    if (error) throw new Error(`Garmin soft-delete: ${error.message}`)
  }

  const toInsert = [...classification.nouvelles, ...replacements.map(r => r.garmin)]
  const imported = await insertActivitiesWithMetrics(supabase, userId, toInsert, profile)

  const dates = toInsert.map(m => m.normalized.startTime).sort()
  return {
    totalParsed: classification.nouvelles.length + classification.conflits.length,
    imported,
    conflictsKeptStrava: keptStrava,
    conflictsReplaced: replacements.length,
    errors: 0,
    warnings: [],
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null,
  }
}
