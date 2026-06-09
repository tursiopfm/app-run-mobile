// web/app/api/garmin-import/existing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import type { ExistingActivity } from '@/lib/garmin-import/types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  let q = supabase
    .from('activities')
    .select('id, provider, provider_activity_id, start_time, moving_time_sec, duration_sec, distance_m, avg_hr, elevation_gain_m')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('start_time', { ascending: true })
    .limit(10000)
  if (from) q = q.gte('start_time', from)
  if (to) q = q.lte('start_time', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const out: ExistingActivity[] = (data ?? []).map(r => ({
    id: String(r.id), provider: String(r.provider), providerActivityId: String(r.provider_activity_id),
    startTime: String(r.start_time), movingTimeSec: Number(r.moving_time_sec ?? 0),
    durationSec: Number(r.duration_sec ?? 0), distanceM: Number(r.distance_m ?? 0),
    avgHr: r.avg_hr != null ? Number(r.avg_hr) : null,
    elevationGainM: r.elevation_gain_m != null ? Number(r.elevation_gain_m) : null,
  }))
  return NextResponse.json(out)
}
