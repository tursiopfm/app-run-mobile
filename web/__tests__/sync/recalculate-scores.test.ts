import { recalculateUserEffortScores } from '@/lib/sync/recalculate-scores'
import { computeStreamMetrics } from '@/lib/activities/stream-metrics'
import { computeHrTimeHistogram } from '@/lib/health/hr-zones'

const time      = Array.from({ length: 1300 }, (_, i) => i)
const heartrate = Array.from({ length: 1300 }, (_, i) => (i < 650 ? 150 : 158))
const trailStreams = {
  time,
  altitude:  Array.from({ length: 1300 }, (_, i) => (i < 650 ? i * 0.2 : 130 - (i - 650) * 0.2)),
  velocity:  Array.from({ length: 1300 }, () => 2.5),
  grade:     Array.from({ length: 1300 }, (_, i) => (i < 650 ? 8 : -8)),
  heartrate,
}

// Le recalcul ne lit plus streams_gz (cf. migration 047) : il lit l'histogramme FC
// et les métriques dérivées, toutes deux écrites à l'ingestion.
const hrTimeHist = computeHrTimeHistogram(heartrate, time)
const streamMetrics = computeStreamMetrics(trailStreams)

const captured: Record<string, Array<Record<string, unknown>>> = {}

// Chaîne de requête PostgREST : chaque maillon renvoie le suivant, `range` résout.
function query(data: unknown[]) {
  const chain: Record<string, unknown> = {}
  const link = () => chain
  chain.select = link
  chain.eq = link
  chain.in = link
  chain.order = link
  chain.range = async () => ({ data, error: null })
  return chain
}

jest.mock('@/lib/database/supabase-server', () => ({
  createServiceClient: () => ({
    from: (name: string) => {
      if (name === 'profiles') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { max_hr: 195, resting_hr: 54, threshold_pace_trail_sec_per_km: null } }) }) }),
      }
      if (name === 'activities') return {
        // ces:100 ≠ valeur SP-2 → "changed"
        ...query([{ id: 'a1', ces: 100, sport_type: 'TrailRun', name: 'Trail', start_time: '2026-06-01', duration_sec: 1300, moving_time_sec: 1300, distance_m: 9000, elevation_gain_m: 520, avg_hr: 154, max_hr: 170, avg_power: null }]),
        // write = update().eq('id', …) par ligne (pas un upsert)
        update: (vals: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            captured.activityUpdate = captured.activityUpdate ?? []
            captured.activityUpdate.push({ id, ...vals })
            return { error: null }
          },
        }),
      }
      if (name === 'activity_streams') return query([{ activity_id: 'a1', hr_time_hist: hrTimeHist }])
      if (name === 'activity_metrics') return {
        ...query([
          { activity_id: 'a1', metric_key: 'grade_adjusted_pace_s', metric_value: streamMetrics.gradeAdjustedPaceS },
          { activity_id: 'a1', metric_key: 'decoupling_pct',        metric_value: streamMetrics.decouplingPct },
          { activity_id: 'a1', metric_key: 'elevation_loss_m',      metric_value: streamMetrics.elevationLossM },
        ]),
        upsert: async (rows: Array<Record<string, unknown>>) => { captured.activity_metrics = rows; return { error: null } },
      }
      return {}
    },
  }),
}))

describe('recalculateUserEffortScores sans relire les streams', () => {
  it('applique SP-2, écrit le CES par UPDATE et les métriques de streams', async () => {
    const r = await recalculateUserEffortScores('u1')
    expect(r.recalculated).toBe(1)
    expect(r.errors).toBe(0)
    // CES écrit via update().eq(), pas via upsert
    expect(captured.activityUpdate).toHaveLength(1)
    expect(Number(captured.activityUpdate[0].ces)).toBeGreaterThan(0)
    const keys = captured.activity_metrics.map(m => m.metric_key as string)
    expect(keys).toEqual(expect.arrayContaining(['grade_adjusted_pace_s', 'decoupling_pct', 'elevation_loss_m', 'cardio_load', 'muscle_load', 'intensity_factor']))
  })

  it('persiste computed_intensity classée depuis l\'histogramme FC (pas la FC moyenne)', async () => {
    // 650 s à 150 bpm (Z2) puis 650 s à 158 bpm (Z3) avec FC max 195 → pct_max Z3 =
    // 153-166 → ≥ 20 % du temps en Z3+ → endurance_active (Tempo). La FC moyenne seule
    // (154) sous-estimerait l'intensité : c'est tout l'enjeu, et l'histogramme le préserve.
    await recalculateUserEffortScores('u1')
    const last = captured.activityUpdate[captured.activityUpdate.length - 1]
    expect(last.computed_intensity).toBe('endurance_active')
  })
})
