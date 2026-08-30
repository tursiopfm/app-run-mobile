import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { createServiceClient } from '@/lib/database/supabase-server'
import { unpackStreams } from '@/lib/providers/strava/streams'
import { computeHrTimeHistogram } from '@/lib/health/hr-zones'
import { computeStreamMetrics } from '@/lib/activities/stream-metrics'

// Backfill unique de activity_streams.hr_time_hist (migration 047) et des métriques
// dérivées du stream. C'est la SEULE passe qui relit streams_gz en masse : ensuite le
// recalcul CES ne lit plus que l'histogramme. Appeler en boucle tant que done = false.
//
// Traite un lot par appel (streams_gz est lourd : ~10 kB/ligne) pour rester sous le
// maxDuration Vercel et sous la limite mémoire.
export const maxDuration = 60

const BATCH = 150

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await getIsAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const batch = Math.min(Number(req.nextUrl.searchParams.get('batch') ?? BATCH) || BATCH, 300)
  const supabase = createServiceClient()

  const { data: rows, error } = await supabase
    .from('activity_streams')
    .select('activity_id, streams_gz')
    .is('hr_time_hist', null)
    .limit(batch)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ done: true, processed: 0, remaining: 0 })

  const now = new Date().toISOString()
  const metricRows: { activity_id: string; metric_key: string; metric_value: number; computed_at: string }[] = []
  let processed = 0
  let unreadable = 0

  for (const row of rows as { activity_id: string; streams_gz: string }[]) {
    const activityId = String(row.activity_id)
    let hist: number[] = []
    try {
      const streams = unpackStreams(String(row.streams_gz))
      hist = streams.heartrate?.length && streams.time?.length
        ? computeHrTimeHistogram(streams.heartrate, streams.time)
        : []

      const m = computeStreamMetrics(streams)
      if (m.gradeAdjustedPaceS != null) metricRows.push({ activity_id: activityId, metric_key: 'grade_adjusted_pace_s', metric_value: m.gradeAdjustedPaceS, computed_at: now })
      if (m.decouplingPct != null)      metricRows.push({ activity_id: activityId, metric_key: 'decoupling_pct',        metric_value: m.decouplingPct,      computed_at: now })
      if (m.elevationLossM != null)     metricRows.push({ activity_id: activityId, metric_key: 'elevation_loss_m',      metric_value: m.elevationLossM,     computed_at: now })
    } catch {
      unreadable++
      // Stream illisible : on écrit tout de même un histogramme vide, sinon la ligne
      // resterait éligible et le backfill boucherait indéfiniment sur elle.
    }

    const { error: uErr } = await supabase
      .from('activity_streams')
      .update({ hr_time_hist: hist })
      .eq('activity_id', activityId)
    if (!uErr) processed++
  }

  if (metricRows.length > 0) {
    const { error: mErr } = await supabase
      .from('activity_metrics')
      .upsert(metricRows, { onConflict: 'activity_id,metric_key' })
    if (mErr) console.error('[backfill-hr-hist] metrics upsert', mErr)
  }

  const { count: remaining } = await supabase
    .from('activity_streams')
    .select('activity_id', { count: 'exact', head: true })
    .is('hr_time_hist', null)

  return NextResponse.json({
    done: (remaining ?? 0) === 0,
    processed,
    unreadable,
    metricsWritten: metricRows.length,
    remaining: remaining ?? 0,
  })
}
