import { createServiceClient } from '@/lib/database/supabase-server'
import { computeCesResult } from '@/lib/analytics/effort-score'
import type { UserProfileForCes, ActivityInput, CesStreamMetrics } from '@/lib/analytics/types'
import { calculateHrZones, zoneTimesFromHistogram, type HrZone, type CustomZoneInput, type HrZoneMethod } from '@/lib/health/hr-zones'
import { classifyIntensityFromZoneTimes, guessIntensity, type IntensityKey } from '@/lib/activities/intensity'

// Métriques dérivées du stream, écrites à l'ingestion et relues ici plutôt que
// recalculées depuis streams_gz.
const STREAM_METRIC_KEYS = ['grade_adjusted_pace_s', 'decoupling_pct', 'elevation_loss_m']

const PAGE_SIZE = 1000

// PostgREST plafonne chaque requête à 1000 lignes : on boucle jusqu'à épuisement.
async function fetchAllPages<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break
  }
  return all
}

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

  // Toutes les activités, paginées : sans la boucle, le cap PostgREST de 1000 lignes
  // rendait le recalcul silencieusement partiel (1000 sur 5389 pour le plus gros compte).
  const activities = await fetchAllPages<Record<string, unknown>>((from, to) =>
    supabase
      .from('activities')
      .select('id, ces, sport_type, name, start_time, duration_sec, moving_time_sec, distance_m, elevation_gain_m, avg_hr, max_hr, avg_power, computed_intensity')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .range(from, to),
  )

  if (!activities.length) return { recalculated: 0, errors: 0 }

  // Temps par zone FC depuis l'histogramme (migration 047), jamais depuis streams_gz :
  // ~1 kB par activité au lieu de ~10 kB, pour un résultat identique.
  const histRows = await fetchAllPages<{ activity_id: string; hr_time_hist: number[] | null }>((from, to) =>
    supabase
      .from('activity_streams')
      .select('activity_id, hr_time_hist')
      .eq('user_id', userId)
      .order('activity_id', { ascending: true })
      .range(from, to),
  )

  // Métriques dérivées du stream, déjà persistées à l'ingestion. activity_metrics n'a
  // pas de user_id → filtrage par jointure sur activities.
  const metricRows = await fetchAllPages<{ activity_id: string; metric_key: string; metric_value: number }>((from, to) =>
    supabase
      .from('activity_metrics')
      .select('activity_id, metric_key, metric_value, activities!inner(user_id)')
      .eq('activities.user_id', userId)
      .in('metric_key', STREAM_METRIC_KEYS)
      .order('activity_id', { ascending: true })
      .range(from, to),
  )

  const smByActivity = new Map<string, CesStreamMetrics>()
  for (const row of metricRows) {
    const id = String(row.activity_id)
    const sm = smByActivity.get(id) ?? {}
    const value = Number(row.metric_value)
    if (row.metric_key === 'grade_adjusted_pace_s')  sm.gradeAdjustedPaceS = value
    else if (row.metric_key === 'decoupling_pct')    sm.decouplingPct      = value
    else if (row.metric_key === 'elevation_loss_m')  sm.elevationLossM     = value
    smByActivity.set(id, sm)
  }

  const zoneTimesByActivity = new Map<string, number[]>()
  // Stream présent mais histogramme jamais calculé (null, en attente du backfill 047) :
  // on préserve la computed_intensity existante au lieu de la dégrader en estimation
  // depuis la FC moyenne. [] = traité, sans cardio → estimation légitime.
  const awaitingHistogram = new Set<string>()
  for (const row of histRows) {
    if (row.hr_time_hist == null) { awaitingHistogram.add(String(row.activity_id)); continue }
    if (!row.hr_time_hist.length || hrZones.length !== 5) continue
    zoneTimesByActivity.set(String(row.activity_id), zoneTimesFromHistogram(hrZones, row.hr_time_hist))
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
      const ciChanged =
        !awaitingHistogram.has(String(act.id)) &&
        computedIntensity !== ((act.computed_intensity as string | null) ?? null)

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
