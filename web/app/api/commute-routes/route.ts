import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { extractCommuteGeo } from '@/lib/activities/commute'
import { rowToCommuteRoute } from '@/lib/sync/assign-commute-name'

// GET /api/commute-routes → liste des trajets domicile-travail du user (camelCase).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('commute_routes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const routes = (data ?? []).map(rowToCommuteRoute)
  return NextResponse.json({ routes })
}

// POST /api/commute-routes
// Crée un trajet à partir d'une activité de référence.
// IMPORTANT : l'activité de référence DOIT être un ALLER domicile → travail :
//   home  = start_latlng (départ)
//   office = end_latlng  (arrivée)
type PostBody = {
  fromActivityId: string
  label: string
  outboundTitle: string
  returnTitle: string
  distanceTolPct?: number
  geoTolM?: number
  hourSplit?: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as PostBody
  const { fromActivityId, label, outboundTitle, returnTitle } = body

  if (!fromActivityId || !label || !outboundTitle || !returnTitle) {
    return NextResponse.json(
      { error: 'fromActivityId, label, outboundTitle et returnTitle sont requis' },
      { status: 400 },
    )
  }

  const { data: activity, error: actErr } = await supabase
    .from('activities')
    .select('sport_type, distance_m, raw_payload')
    .eq('id', fromActivityId)
    .eq('user_id', user.id)
    .single()

  if (actErr || !activity) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  const geo = extractCommuteGeo(activity.raw_payload)
  if (!geo.start || !geo.end) {
    return NextResponse.json(
      { error: 'L\'activité de référence doit avoir un point de départ ET d\'arrivée (GPS).' },
      { status: 400 },
    )
  }

  const refDistanceM = geo.distanceM ?? Number(activity.distance_m)
  if (!refDistanceM || refDistanceM <= 0) {
    return NextResponse.json({ error: 'Distance de référence invalide' }, { status: 400 })
  }

  const insert: Record<string, unknown> = {
    user_id: user.id,
    sport_type: activity.sport_type,
    label,
    ref_distance_m: refDistanceM,
    home_lat: geo.start[0],
    home_lng: geo.start[1],
    office_lat: geo.end[0],
    office_lng: geo.end[1],
    outbound_title: outboundTitle,
    return_title: returnTitle,
  }
  if (body.distanceTolPct != null) insert.distance_tol_pct = body.distanceTolPct
  if (body.geoTolM != null) insert.geo_tol_m = body.geoTolM
  if (body.hourSplit != null) insert.hour_split = body.hourSplit

  const { data: row, error: insErr } = await supabase
    .from('commute_routes')
    .insert(insert)
    .select('*')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({ route: rowToCommuteRoute(row) })
}
