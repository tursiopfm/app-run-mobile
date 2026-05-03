import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { stravaSyncer } from '@/lib/providers/strava/syncer'
import { importActivities } from '@/lib/sync/import-activities'

export async function POST() {
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

  try {
    const activities = await stravaSyncer.fetchActivities(user.id)
    const result = await importActivities(activities)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
