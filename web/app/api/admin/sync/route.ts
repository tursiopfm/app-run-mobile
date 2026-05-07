import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { createServiceClient } from '@/lib/database/supabase-server'
import { stravaSyncer } from '@/lib/providers/strava/syncer'
import { importActivities } from '@/lib/sync/import-activities'

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { userId?: string; all?: boolean }
  const supabase = createServiceClient()

  let userIds: string[] = []
  if (body.all) {
    const { data: connections } = await supabase
      .from('provider_connections')
      .select('user_id')
      .eq('provider', 'strava')
    userIds = (connections ?? []).map(c => c.user_id as string)
  } else if (body.userId) {
    userIds = [body.userId]
  } else {
    return NextResponse.json({ error: 'userId or all required' }, { status: 400 })
  }

  const results: { userId: string; status: 'ok' | 'error'; message?: string }[] = []

  for (const uid of userIds) {
    try {
      const activities = await stravaSyncer.fetchActivities(uid, { fullSync: false })
      await importActivities(activities)
      results.push({ userId: uid, status: 'ok' })
    } catch (err) {
      results.push({ userId: uid, status: 'error', message: err instanceof Error ? err.message : 'Sync failed' })
    }
  }

  return NextResponse.json({ results })
}
