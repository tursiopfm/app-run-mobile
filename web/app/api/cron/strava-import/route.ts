import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/database/supabase-server'
import { processOneImportTick } from '@/lib/providers/strava/import'

const MAX_USERS_PER_TICK = 5
const STALE_THRESHOLD_SEC = 50
const MAX_CASCADE_DEPTH = 50 // 50 ticks × 200 act = 10k activités max par cascade

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function GET(request: Request) {
  // Auth: header injecté par Vercel pour les crons. Fail closed if secret missing.
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cascadeDepth = parseInt(request.headers.get('x-cascade-depth') ?? '0', 10)

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
  console.log('[cron strava-import] processing', userIds.length, 'user(s), cascade depth', cascadeDepth)

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

  const resultValues = results.map((r) => r.status === 'fulfilled' ? r.value : { error: String(r.reason) })

  // Auto-cascade: si au moins un user a encore des pages à fetch (done=false, pas rate-limited, pas d'erreur),
  // fire-and-forget un nouveau tick. Import complet en ~75s au lieu de 2h via GitHub Actions seul.
  const hasMore = resultValues.some((r) =>
    'done' in r && r.done === false && r.rateLimited === false
  )
  if (hasMore && cascadeDepth < MAX_CASCADE_DEPTH) {
    // waitUntil: garde la fonction en vie jusqu'à ce que le fetch ait été émis.
    // Sans ça, Vercel tue la fonction dès le `return` → la cascade ne part jamais.
    waitUntil(
      fetch(`${APP_URL}/api/cron/strava-import`, {
        headers: {
          Authorization: `Bearer ${secret}`,
          'X-Cascade-Depth': String(cascadeDepth + 1),
        },
      }).catch((err) => console.error('[cron] cascade trigger failed:', err))
    )
  }

  return NextResponse.json({
    processed: userIds.length,
    cascadeDepth,
    cascaded: hasMore && cascadeDepth < MAX_CASCADE_DEPTH,
    results: resultValues,
  })
}
