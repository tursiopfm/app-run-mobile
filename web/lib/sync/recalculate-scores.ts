import { createServiceClient } from '@/lib/database/supabase-server'
import { computeCesResult } from '@/lib/analytics/effort-score'
import type { UserProfileForCes, ActivityInput, CesStreamMetrics } from '@/lib/analytics/types'
import { unpackStreams } from '@/lib/providers/strava/streams'
import { computeStreamMetrics } from '@/lib/activities/stream-metrics'
import { calculateHrZones, computeZoneTimesFromStream, type HrZone, type CustomZoneInput, type HrZoneMethod } from '@/lib/health/hr-zones'
import { classifyIntensityFromZoneTimes, guessIntensity, type IntensityKey } from '@/lib/activities/intensity'

function toActivityInput(row: Record<string, unknown>): ActivityInput {
  return {
    id:                   String(row.id),
    rawSportType:         String(row.sport_type ?? ''),
    name:                 row.name ? String(row.name) : undefined,
    startDate:            String(row.start_time ?? ''),
    movingTimeSeconds:    Number(row.moving_time_sec ?? row.duration_sec ?? 0),
    elapsedTimeSeconds:   row.duration_sec ? Number(row.duration_sec) : undefined,
    distanceMeters:       row.distance_m ? Number(row.distance_m) : undefined,
    elevationGainMeters:  row.elevation_gain_m ? Number(row.elevation_gain_m) : undefined,
    averageHeartrate:     row.avg_hr ? Number(row.avg_hr) : undefined,
    maxHeartrate:         row.max_hr ? Number(row.max_hr) : undefined,
    averageWatts:         row.avg_power ? Number(row.avg_power) : undefined,
  }
}

export async function recalculateUserEffortScores(userId: string): Promise<{ recalculated: number; errors: number }> {
  const supabase = createServiceClient()

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km, birth_year, hr_zone_method, hr_zones_custom')
    .eq('id', userId)
    .single()

  const profile: UserProfileForCes = profileRow ?? {}

  // Zones FC du profil → classification d'intensité depuis le stream (persistée
  // sur `activities.computed_intensity`) pour que la liste affiche la même valeur
  // que le détail sans charger les streams. Recalculée ici à chaque recalcul, donc
  // re-fraîchie quand les zones du profil changent.
  const p = (profileRow ?? {}) as Record<string, unknown>
  let hrZones: HrZone[] = []
  try {
    hrZones = calculateHrZones({
      method:             (p.hr_zone_method as HrZoneMethod) ?? 'pct_max',
      maxHr:              p.max_hr as number | null,
      restingHr:          p.resting_hr as number | null,
      aerobicThresholdHr: p.aerobic_threshold_hr as number | null,
      thresholdHr:        p.threshold_hr as number | null,
      birthYear:          p.birth_year as number | null,
      customZones:        p.hr_zones_custom as CustomZoneInput[] | null,
    }).zones
  } catch { hrZones = [] }
  const restingHr = (p.resting_hr as number | null) ?? null

  // Plus récentes d'abord : la fenêtre couverte (cap ~1000 lignes Supabase) inclut
  // les activités récentes (celles qui ont des streams / qui nous intéressent pour SP-2).
  const { data: activities } = await supabase
    .from('activities')
    .select('id, ces, sport_type, name, start_time, duration_sec, moving_time_sec, distance_m, elevation_gain_m, avg_hr, max_hr, avg_power, computed_intensity')
    .eq('user_id', userId)
    .order('start_time', { ascending: false })

  if (!activities?.length) return { recalculated: 0, errors: 0 }

  // Charger les streams stockés (raw gz) pour appliquer SP-2 ; re-dérive les métriques en local.
  const { data: streamRows } = await supabase
    .from('activity_streams')
    .select('activity_id, streams_gz')
    .eq('user_id', userId)

  const smByActivity = new Map<string, CesStreamMetrics>()
  const zoneTimesByActivity = new Map<string, number[]>()
  for (const sr of streamRows ?? []) {
    try {
      const row = sr as { activity_id: string; streams_gz: string }
      const streams = unpackStreams(String(row.streams_gz))
      const m = computeStreamMetrics(streams)
      smByActivity.set(String(row.activity_id), {
        gradeAdjustedPaceS: m.gradeAdjustedPaceS,
        decouplingPct:      m.decouplingPct,
        elevationLossM:     m.elevationLossM,
      })
      if (hrZones.length === 5 && streams.heartrate?.length && streams.time?.length) {
        zoneTimesByActivity.set(
          String(row.activity_id),
          computeZoneTimesFromStream(hrZones, streams.heartrate, streams.time),
        )
      }
    } catch { /* stream illisible → fallback (pas de sm) */ }
  }

  const now = new Date().toISOString()
  const activityUpdates: Array<{ id: string; vals: Record<string, unknown> }> = []
  const metricUpdates:   Array<{ activity_id: string; metric_key: string; metric_value: number; computed_at: string }> = []

  let errors = 0
  for (const act of activities) {
    try {
      const sm = smByActivity.get(String(act.id))
      const result = computeCesResult(toActivityInput(act), profile, sm)
      const changed = result.ces !== Number(act.ces ?? NaN)

      // Intensité calculée : stream FC réel si dispo (le plus juste), sinon
      // estimation depuis la FC moyenne. Même cascade que la vue détail.
      const zoneTimes = zoneTimesByActivity.get(String(act.id)) ?? null
      const computedIntensity: IntensityKey | null =
        (zoneTimes ? classifyIntensityFromZoneTimes(zoneTimes) : null) ??
        guessIntensity(
          act.avg_hr != null ? Number(act.avg_hr) : null,
          hrZones,
          {
            activityMaxHr: act.max_hr != null ? Number(act.max_hr) : null,
            movingTimeSec: Number(act.moving_time_sec ?? act.duration_sec ?? 0) || null,
            restingHr,
          },
        )
      const ciChanged = computedIntensity !== ((act.computed_intensity as string | null) ?? null)

      const vals: Record<string, unknown> = {}
      if (changed) {
        vals.ces = result.ces
        vals.effort_score_version = result.version
        vals.effort_score_updated_at = now
      }
      if (ciChanged) vals.computed_intensity = computedIntensity
      if (Object.keys(vals).length > 0) {
        activityUpdates.push({ id: String(act.id), vals })
      }
      // On (re)écrit les métriques pour les activités modifiées ou streamées.
      if (changed || sm) {
        metricUpdates.push(
          { activity_id: String(act.id), metric_key: 'cardio_load',      metric_value: result.cardioLoad,      computed_at: now },
          { activity_id: String(act.id), metric_key: 'muscle_load',      metric_value: result.muscleLoad,      computed_at: now },
          { activity_id: String(act.id), metric_key: 'intensity_factor', metric_value: result.intensityFactor, computed_at: now },
        )
        if (sm?.gradeAdjustedPaceS != null) metricUpdates.push({ activity_id: String(act.id), metric_key: 'grade_adjusted_pace_s', metric_value: sm.gradeAdjustedPaceS, computed_at: now })
        if (sm?.decouplingPct != null)      metricUpdates.push({ activity_id: String(act.id), metric_key: 'decoupling_pct',        metric_value: sm.decouplingPct,      computed_at: now })
        if (sm?.elevationLossM != null)     metricUpdates.push({ activity_id: String(act.id), metric_key: 'elevation_loss_m',      metric_value: sm.elevationLossM,     computed_at: now })
      }
    } catch (e) {
      console.error('[recalculateUserEffortScores] activity', act.id, e)
      errors++
    }
  }

  // Écriture des CES : UPDATE par ligne (les activités existent déjà). Un upsert
  // ferait un INSERT qui violerait les NOT NULL non fournis (user_id, provider…).
  // Seules les activités dont le CES a changé sont écrites → set réduit, pas de timeout.
  const CHUNK = 100
  for (let i = 0; i < activityUpdates.length; i += CHUNK) {
    const results = await Promise.all(
      activityUpdates.slice(i, i + CHUNK).map(u =>
        supabase
          .from('activities')
          .update(u.vals)
          .eq('id', u.id),
      ),
    )
    for (const r of results) {
      if (r.error) { console.error('[recalculateUserEffortScores] update', r.error); errors++ }
    }
  }

  if (metricUpdates.length > 0) {
    const { error: mError } = await supabase
      .from('activity_metrics')
      .upsert(metricUpdates, { onConflict: 'activity_id,metric_key' })
    if (mError) console.error('[recalculateUserEffortScores] batch metrics upsert', mError)
  }

  return { recalculated: activityUpdates.length, errors }
}

// NB : la table `daily_metrics` (ATL/CTL/TSB par jour) n'est plus maintenue.
// Les vues Charge et Cockpit recalculent l'EWMA à la volée sur ~1 an
// d'historique (cf. buildChargeMetrics) → une seule source de vérité, toujours
// fraîche. Voir tasks/backlog.md si on veut la réactiver comme cache serveur.
