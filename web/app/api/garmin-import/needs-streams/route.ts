// web/app/api/garmin-import/needs-streams/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import type { EnrichCandidate } from '@/lib/garmin-import/enrich-types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  let q = supabase
    .from('activities')
    .select('id, provider, provider_activity_id, start_time, activity_streams(activity_id), map:raw_payload->map')
    .eq('user_id', user.id).is('deleted_at', null)
    .order('start_time', { ascending: true }).limit(20000)
  if (from) q = q.gte('start_time', from)
  if (to) q = q.lte('start_time', to)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Candidat à enrichir si : aucun stream (streams FC/altitude…) OU activité Garmin sans
  // carte (polyline) → ré-enrichissement pour ajouter GPS + splits aux Garmin déjà streamées.
  const out: EnrichCandidate[] = (data ?? [])
    .filter((r) => {
      const row = r as { provider: string; activity_streams?: unknown[]; map?: { summary_polyline?: string } | null }
      const noStream = !row.activity_streams || row.activity_streams.length === 0
      const garminNoMap = row.provider === 'garmin' && !row.map?.summary_polyline
      return noStream || garminNoMap
    })
    .map((r) => {
      const row = r as { id: string; provider: string; provider_activity_id: string; start_time: string }
      return { id: String(row.id), provider: String(row.provider), providerActivityId: String(row.provider_activity_id), startTime: String(row.start_time) }
    })
  return NextResponse.json(out)
}
