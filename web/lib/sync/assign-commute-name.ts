// Orchestration DB + Strava pour l'attribution automatique du titre des trajets
// domicile-travail. Appelable depuis le webhook (edge, client service) ou une route API.

import {
  type CommuteRoute,
  buildCommuteTitle,
  extractCommuteGeo,
  matchCommute,
  parseCommuteSeq,
  pickCommuteSeq,
} from '@/lib/activities/commute'

// Type minimal compatible avec les clients Supabase utilisés (service + SSR).
// On reste volontairement structurel pour éviter de coupler edge/SSR.
export type SupabaseLike = {
  from: (table: string) => any
}

type CommuteRouteRow = {
  id: string
  user_id: string
  sport_type: string
  label: string
  ref_distance_m: number
  distance_tol_pct: number
  home_lat: number | null
  home_lng: number | null
  office_lat: number | null
  office_lng: number | null
  geo_tol_m: number
  outbound_title: string
  return_title: string
  hour_split: number
  active: boolean
}

export function rowToCommuteRoute(row: CommuteRouteRow): CommuteRoute {
  return {
    id: row.id,
    userId: row.user_id,
    sportType: row.sport_type,
    label: row.label,
    refDistanceM: Number(row.ref_distance_m),
    distanceTolPct: Number(row.distance_tol_pct),
    homeLat: row.home_lat != null ? Number(row.home_lat) : null,
    homeLng: row.home_lng != null ? Number(row.home_lng) : null,
    officeLat: row.office_lat != null ? Number(row.office_lat) : null,
    officeLng: row.office_lng != null ? Number(row.office_lng) : null,
    geoTolM: Number(row.geo_tol_m),
    outboundTitle: row.outbound_title,
    returnTitle: row.return_title,
    hourSplit: Number(row.hour_split),
    active: row.active,
  }
}

type ActivityForAssign = {
  id: string
  providerActivityId: string
  sportType: string
  name: string | null
  startTime: string
  rawPayload: unknown
}

type AssignOpts = {
  supabase: SupabaseLike
  userId: string
  activity: ActivityForAssign
  routes?: CommuteRoute[]
  updateStrava?: (activityId: string, name: string) => Promise<void>
}

type AssignResult = { matched: boolean; renamed: boolean; seq?: number }

const MANUAL_TITLE_RE = /^\d{4}#\d+/

export async function assignCommuteName(opts: AssignOpts): Promise<AssignResult> {
  const { supabase, userId, activity } = opts

  // 1. Charger les routes actives si non fournies
  let routes: CommuteRoute[]
  if (opts.routes) {
    routes = opts.routes
  } else {
    const { data, error } = await supabase
      .from('commute_routes')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
    if (error) throw new Error(`commute_routes load: ${error.message}`)
    routes = (data ?? []).map((r: CommuteRouteRow) => rowToCommuteRoute(r))
  }

  // 2. Détection
  const geo = extractCommuteGeo(activity.rawPayload)
  const match = matchCommute({ sportType: activity.sportType, geo }, routes)
  if (!match) return { matched: false, renamed: false }

  const route = match.route

  // 3. Année + clé du jour
  const year = new Date(activity.startTime).getUTCFullYear()
  const dayKey = activity.startTime.slice(0, 10)

  // 4. Charger toutes les activités candidates pour calculer seq + jumeau :
  //    (a) celles déjà liées à cette route ;
  //    (b) celles dont le nom commence par `${year}#` et dont le suffixe correspond
  //        aux gabarits de la route (titres posés manuellement avant la création du trajet).
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  type Sib = {
    id: string
    name: string | null
    start_time: string
    commute_seq: number | null
    commute_route_id: string | null
  }

  const [linkedRes, numberedRes] = await Promise.all([
    supabase
      .from('activities')
      .select('id, name, start_time, commute_seq, commute_route_id')
      .eq('user_id', userId)
      .eq('commute_route_id', route.id)
      .gte('start_time', yearStart)
      .lt('start_time', yearEnd)
      .is('deleted_at', null),
    supabase
      .from('activities')
      .select('id, name, start_time, commute_seq, commute_route_id')
      .eq('user_id', userId)
      .gte('start_time', yearStart)
      .lt('start_time', yearEnd)
      .is('deleted_at', null)
      .ilike('name', `${year}#%`),
  ])
  if (linkedRes.error) throw new Error(`siblings load: ${linkedRes.error.message}`)
  if (numberedRes.error) throw new Error(`numbered load: ${numberedRes.error.message}`)

  const outboundSuffix = ` ${route.outboundTitle}`
  const returnSuffix = ` ${route.returnTitle}`
  const byId = new Map<string, Sib>()
  for (const r of (linkedRes.data ?? []) as Sib[]) byId.set(r.id, r)
  for (const r of (numberedRes.data ?? []) as Sib[]) {
    if (byId.has(r.id)) continue
    if (!r.name) continue
    if (r.name.endsWith(outboundSuffix) || r.name.endsWith(returnSuffix)) byId.set(r.id, r)
  }
  const rows: Sib[] = Array.from(byId.values())

  const seq: number = pickCommuteSeq(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      startTime: r.start_time,
      commuteSeq: r.commute_seq,
    })),
    activity.id,
    dayKey,
    year,
  )

  // 5. Titre cible
  const title = buildCommuteTitle(route, match.direction, year, seq)

  // 6. Garde-fous sur le rename
  let renamed = false
  let seqToWrite = seq
  const currentName = activity.name

  if (currentName === title) {
    // Déjà le bon titre → on écrit juste les colonnes commute_*
    renamed = false
  } else if (currentName && MANUAL_TITLE_RE.test(currentName)) {
    // Titre manuel existant (`YYYY#N ...`) différent → ne pas écraser le nom
    renamed = false
    const existingSeq = parseCommuteSeq(currentName, year)
    if (existingSeq != null) seqToWrite = existingSeq
  } else {
    renamed = true
  }

  // 7. Update activities
  const update: Record<string, unknown> = {
    commute_route_id: route.id,
    commute_seq: seqToWrite,
    commute_direction: match.direction,
  }
  if (renamed) update.name = title

  const { error: updErr } = await supabase
    .from('activities')
    .update(update)
    .eq('id', activity.id)
    .eq('user_id', userId)
  if (updErr) throw new Error(`activity update: ${updErr.message}`)

  // 8. Strava best-effort
  if (renamed && opts.updateStrava) {
    try {
      await opts.updateStrava(activity.providerActivityId, title)
    } catch (err) {
      console.warn('[commute] strava rename failed', activity.providerActivityId, String(err))
    }
  }

  return { matched: true, renamed, seq: seqToWrite ?? undefined }
}
