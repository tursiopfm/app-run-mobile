import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { getValidStravaToken } from '@/lib/providers/strava/token'
import { updateStravaActivityName } from '@/lib/providers/strava/api'
import { rowToCommuteRoute } from '@/lib/sync/assign-commute-name'
import { assignCommuteName } from '@/lib/sync/assign-commute-name'
import type { CommuteRoute } from '@/lib/activities/commute'

// Laisse le temps de traiter séquentiellement un historique complet.
export const maxDuration = 300

// POST /api/commute-routes/apply
// Application rétroactive : reparcourt tout l'historique du user dans l'ordre
// chronologique et attribue les titres de trajet. Réutilise assignCommuteName,
// donc les seq déjà posés et les titres manuels (`YYYY#N ...`) sont préservés.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: routeRows, error: routeErr } = await supabase
    .from('commute_routes')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
  if (routeErr) return NextResponse.json({ error: routeErr.message }, { status: 500 })

  const routes: CommuteRoute[] = (routeRows ?? []).map(rowToCommuteRoute)
  if (routes.length === 0) {
    return NextResponse.json({ matched: 0, renamed: 0 })
  }

  const { data: acts, error: actErr } = await supabase
    .from('activities')
    .select('id, provider_activity_id, sport_type, manual_sport_type, name, start_time, raw_payload')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('start_time', { ascending: true })
  if (actErr) return NextResponse.json({ error: actErr.message }, { status: 500 })

  let token: string | null = null
  try {
    token = await getValidStravaToken(user.id)
  } catch {
    token = null // pas de connexion Strava → on met quand même à jour la base
  }

  let matched = 0
  let renamed = 0

  for (const a of acts ?? []) {
    const res = await assignCommuteName({
      supabase,
      userId: user.id,
      activity: {
        id: a.id,
        providerActivityId: String(a.provider_activity_id),
        sportType: a.manual_sport_type ?? a.sport_type,
        name: a.name,
        startTime: a.start_time,
        rawPayload: a.raw_payload,
      },
      routes,
      updateStrava: token
        ? (id, name) => updateStravaActivityName(token as string, Number(id), name)
        : undefined,
    })
    if (res.matched) matched++
    if (res.renamed) renamed++
  }

  return NextResponse.json({ matched, renamed })
}
