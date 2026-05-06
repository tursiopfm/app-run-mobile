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
    const activities = await stravaSyncer.fetchActivities(user.id, { fullSync })
    const result = await importActivities(activities)

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

      const orphanIds = (existing ?? [])
        .filter(a => !stravaIds.has(a.provider_activity_id as string))
        .map(a => a.id as string)

      if (orphanIds.length > 0) {
        await supabase.from('activities').delete().in('id', orphanIds)
        deleted = orphanIds.length
      }
    }

    return NextResponse.json({ ...result, deleted })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
