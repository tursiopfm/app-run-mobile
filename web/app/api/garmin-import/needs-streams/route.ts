// web/app/api/garmin-import/needs-streams/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import type { EnrichCandidate } from '@/lib/garmin-import/enrich-types'

export const maxDuration = 60

type Row = {
  id: string
  provider: string
  provider_activity_id: string
  start_time: string
  activity_streams?: unknown[]
  map?: { summary_polyline?: string } | null
  begin?: string | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  // PAGINATION : PostgREST plafonne une requête (~1000 lignes). Sans paginer, seules les
  // 1000 activités les plus ANCIENNES étaient renvoyées (2018-2019) → les récentes n'étaient
  // jamais candidates à l'enrichissement. On boucle par pages de 1000 jusqu'à tout récupérer.
  const PAGE = 1000
  const rows: Row[] = []
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase
      .from('activities')
      .select('id, provider, provider_activity_id, start_time, activity_streams(activity_id), map:raw_payload->map, begin:raw_payload->summary->>beginTimestamp')
      .eq('user_id', user.id).is('deleted_at', null)
      .order('start_time', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (from) q = q.gte('start_time', from)
    if (to) q = q.lte('start_time', to)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
  }

  // Candidat à enrichir si : aucun stream (FC/altitude…) OU activité Garmin sans carte
  // (polyline) → ajoute GPS + splits, y compris aux Garmin déjà streamées sans carte.
  const out: EnrichCandidate[] = rows
    .filter((row) => {
      const noStream = !row.activity_streams || row.activity_streams.length === 0
      const garminNoMap = row.provider === 'garmin' && !row.map?.summary_polyline
      return noStream || garminNoMap
    })
    .map((row) => {
      // startMs = instant UTC RÉEL : beginTimestamp Garmin (GMT ms) si dispo, sinon parse de
      // start_time (heure locale étiquetée UTC — fallback non-Garmin). Le FIT étant en GMT,
      // matcher sur beginTimestamp évite le décalage de fuseau qui faisait tout rater.
      const beginMs = row.begin != null ? Number(row.begin) : NaN
      const startMs = Number.isFinite(beginMs) ? beginMs : Date.parse(row.start_time)
      return {
        id: String(row.id),
        provider: String(row.provider),
        providerActivityId: String(row.provider_activity_id),
        startTime: String(row.start_time),
        startMs,
      }
    })
  return NextResponse.json(out)
}
