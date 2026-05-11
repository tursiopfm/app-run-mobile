import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/database/supabase-server'
import { processOneImportTick } from '@/lib/providers/strava/import'

const MAX_USERS_PER_TICK = 5
const STALE_THRESHOLD_SEC = 50
const MAX_CASCADE_DEPTH = 50
const PAGES_PER_TICK = 5 // 5 × 200 = 1000 activités par invocation (~6-8s sous timeout 10s Hobby)

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

  // Sur une cascade (depth > 0), on saute le filtre de staleness car le tick
  // précédent est terminé (garanti par waitUntil). Sinon, on filtre les jobs
  // dont le dernier update remonte à > 50s (anti-chevauchement pour les ticks
  // GitHub Actions ou triggers externes qui pourraient se superposer).
  const isCascade = cascadeDepth > 0
  let query = supabase
    .from('provider_connections')
    .select('user_id')
    .eq('provider', 'strava')
    .in('import_status', ['pending', 'in_progress'])
    .limit(MAX_USERS_PER_TICK)

  if (!isCascade) {
    const staleCutoff = new Date(Date.now() - STALE_THRESHOLD_SEC * 1000).toISOString()
    query = query.or(`import_updated_at.is.null,import_updated_at.lt.${staleCutoff}`)
  }

  const { data: jobs, error } = await query

  if (error) {
    console.error('[cron strava-import] select error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = (jobs ?? []).map((j) => (j as { user_id: string }).user_id)
  console.log('[cron strava-import] processing', userIds.length, 'user(s), cascade depth', cascadeDepth)

  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        const r = await processOneImportTick(userId, PAGES_PER_TICK)
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
    // Cascade : fire-and-forget pur via keepalive.
    // waitUntil(fetch(...)) attendrait la réponse (la chaîne devient synchrone
    // et tape le timeout Vercel 10s après 2-3 hops). keepalive:true garantit que
    // la requête est dispatched même si la fonction meurt immédiatement après.
    // Le waitUntil très court (50ms) donne juste le temps de starter le socket.
    const cascadePromise = fetch(`${APP_URL}/api/cron/strava-import`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        'X-Cascade-Depth': String(cascadeDepth + 1),
      },
      keepalive: true,
    }).catch((err) => console.error('[cron] cascade trigger failed:', err))

    waitUntil(
      Promise.race([
        cascadePromise,
        new Promise((resolve) => setTimeout(resolve, 50)),
      ])
    )
  }

  return NextResponse.json({
    processed: userIds.length,
    cascadeDepth,
    cascaded: hasMore && cascadeDepth < MAX_CASCADE_DEPTH,
    results: resultValues,
  })
}
