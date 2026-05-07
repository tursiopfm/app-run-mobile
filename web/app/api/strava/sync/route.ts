import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { stravaSyncer, INCREMENTAL_WINDOW_DAYS } from '@/lib/providers/strava/syncer'
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

    const result = await importActivities(activities)
    console.log('[sync] upsert:', result.saved, 'sauvegardée(s)')

    let deleted = 0
    if (!fullSync) {
      const cutoff = new Date(Date.now() - INCREMENTAL_WINDOW_DAYS * 86_400_000).toISOString()
      const stravaIds = new Set(activities.map(a => a.providerActivityId))
      const { data: existing } = await supabase
        .from('activities')
        .select('id, provider_activity_id')
        .eq('user_id', user.id)
        .eq('provider', 'strava')
        .gte('start_time', cutoff)
        .is('deleted_at', null)

      const orphanIds = (existing ?? [])
        .filter(a => !stravaIds.has(a.provider_activity_id as string))
        .map(a => a.id as string)

      console.log('[sync] orphelins à supprimer:', orphanIds.length)
      if (orphanIds.length > 0) {
        await supabase.from('activities').update({ deleted_at: new Date().toISOString() }).in('id', orphanIds)
        deleted = orphanIds.length
      }
    }

    console.log('[sync] fin — saved=', result.saved, 'deleted=', deleted)
    return NextResponse.json({ ...result, deleted })
  } catch (err) {
    console.error('[sync] erreur:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
