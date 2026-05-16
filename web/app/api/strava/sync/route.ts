import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { stravaSyncer } from '@/lib/providers/strava/syncer'
import { importActivities } from '@/lib/sync/import-activities'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: connection } = await supabase
    .from('provider_connections')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider', 'strava')
    .single()

  if (!connection) return NextResponse.json({ error: 'Strava not connected' }, { status: 404 })

  const fullSync = new URL(request.url).searchParams.get('full') === 'true'

  try {
    console.log('[sync] début — user=', user.id, 'fullSync=', fullSync)
    const activities = await stravaSyncer.fetchActivities(user.id, { fullSync })
    console.log('[sync] Strava retourne', activities.length, 'activité(s)')

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')
      .eq('id', user.id)
      .single()
    const profile = profileRow ?? {}

    const result = await importActivities(activities, profile)
    console.log('[sync] upsert:', result.saved, 'sauvegardée(s)')

    // NOTE: avant 2026-05-16, ce route faisait un "orphan cleanup" sur la fenêtre
    // incrémentale : toute activité locale absente de la liste Strava récente
    // était soft-deleted. C'est dangereux : si `fetchStravaActivities` renvoie
    // une liste tronquée (page vide ponctuelle, glitch réseau, rate-limit),
    // on supprime des activités qui existent vraiment côté Strava.
    // Incident concret : 8 activités running d'avril 2026 perdues d'un coup
    // (~92 km dont SL Marathon de Paris). Les vraies suppressions Strava sont
    // déjà gérées par webhook (aspect_type=delete) — pas besoin de doublon ici.

    console.log('[sync] fin — saved=', result.saved)
    return NextResponse.json({ ...result, deleted: 0 })
  } catch (err) {
    console.error('[sync] erreur:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
