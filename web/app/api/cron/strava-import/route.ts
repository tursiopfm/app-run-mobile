import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database/supabase-server'
import { processOneImportTick } from '@/lib/providers/strava/import'

const MAX_USERS_PER_TICK = 5
const STALE_THRESHOLD_SEC = 50

export async function GET(request: Request) {
  // Auth: header injecté par Vercel pour les crons. Fail closed if secret missing.
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const staleCutoff = new Date(Date.now() - STALE_THRESHOLD_SEC * 1000).toISOString()

  // Sélection: jobs actifs et non-en-cours
  const { data: jobs, error } = await supabase
    .from('provider_connections')
    .select('user_id')
    .eq('provider', 'strava')
    .in('import_status', ['pending', 'in_progress'])
    .or(`import_updated_at.is.null,import_updated_at.lt.${staleCutoff}`)
    .limit(MAX_USERS_PER_TICK)

  if (error) {
    console.error('[cron strava-import] select error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = (jobs ?? []).map((j) => (j as { user_id: string }).user_id)
  console.log('[cron strava-import] processing', userIds.length, 'user(s)')

  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        const r = await processOneImportTick(userId)
        return { userId, ...r }
      } catch (err) {
        console.error('[cron strava-import] user', userId, 'error:', err)
        return { userId, error: err instanceof Error ? err.message : String(err) }
      }
    })
  )

  return NextResponse.json({
    processed: userIds.length,
    results: results.map((r) => r.status === 'fulfilled' ? r.value : { error: String(r.reason) }),
  })
}
