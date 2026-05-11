import { fetchStravaActivitiesPage } from './api'
import { getValidStravaToken } from './token'
import { stravaToNormalized } from './mapper'
import { importActivities } from '@/lib/sync/import-activities'
import { createServiceClient } from '@/lib/database/supabase-server'
import type { StravaActivity } from './mapper'

const PAGE_SIZE = 200
const DEFAULT_MAX_PAGES = 1

export type TickResult = {
  done: boolean
  savedThisTick: number
  rateLimited: boolean
}

export async function processOneImportTick(
  userId: string,
  maxPages: number = DEFAULT_MAX_PAGES
): Promise<TickResult> {
  const supabase = createServiceClient()

  // Lire le curseur courant
  const { data: connection, error: connErr } = await supabase
    .from('provider_connections')
    .select('import_oldest_at, import_total')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .single()

  if (connErr || !connection) {
    throw new Error('No Strava connection found for user')
  }

  const conn = connection as { import_oldest_at: string | null; import_total: number }
  let currentOldestAt = conn.import_oldest_at
  let cumulativeTotal = conn.import_total ?? 0

  // Marquer in_progress (anti-chevauchement via updated_at)
  await supabase
    .from('provider_connections')
    .update({
      import_status: 'in_progress',
      import_updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava')

  // Préparer ressources réutilisées dans la boucle
  let token: string
  try {
    token = await getValidStravaToken(userId)
  } catch (err) {
    await supabase
      .from('provider_connections')
      .update({
        import_status: 'error',
        import_last_error: err instanceof Error ? err.message : String(err),
        import_updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'strava')
    throw err
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')
    .eq('id', userId)
    .single()
  const profile = (profileRow as Record<string, number | null> | null) ?? {}

  let savedThisTick = 0
  let done = false
  let rateLimited = false

  // Boucle multi-pages : on traite jusqu'à maxPages dans la même invocation
  // pour éviter la fragilité du cascade asynchrone Vercel.
  for (let i = 0; i < maxPages; i++) {
    const before = currentOldestAt
      ? Math.floor(new Date(currentOldestAt).getTime() / 1000)
      : undefined

    let batch: StravaActivity[]
    try {
      batch = await fetchStravaActivitiesPage(token, 1, { before, perPage: PAGE_SIZE })
    } catch (err) {
      if ((err as { rateLimited?: boolean }).rateLimited) {
        rateLimited = true
        break
      }
      await supabase
        .from('provider_connections')
        .update({
          import_status: 'error',
          import_last_error: err instanceof Error ? err.message : String(err),
          import_updated_at: new Date().toISOString(),
          import_total: cumulativeTotal + savedThisTick,
        })
        .eq('user_id', userId)
        .eq('provider', 'strava')
      throw err
    }

    if (batch.length === 0) {
      done = true
      break
    }

    const normalized = batch.map((a) => stravaToNormalized(userId, a))
    const importResult = await importActivities(normalized, profile)
    savedThisTick += importResult.saved

    // Curseur = activité la plus ancienne du batch
    const newOldestUnix = batch.reduce((min, a) => {
      const t = new Date(a.start_date).getTime()
      return t < min ? t : min
    }, Number.POSITIVE_INFINITY)
    currentOldestAt = new Date(newOldestUnix).toISOString()

    if (batch.length < PAGE_SIZE) {
      done = true
      break
    }
  }

  const now = new Date().toISOString()
  const finalUpdates: Record<string, unknown> = {
    import_oldest_at: currentOldestAt,
    import_total: cumulativeTotal + savedThisTick,
    import_updated_at: now,
  }

  if (rateLimited) {
    finalUpdates.import_status = 'pending'
  } else if (done) {
    finalUpdates.import_status = 'completed'
    finalUpdates.import_completed_at = now
  }

  await supabase
    .from('provider_connections')
    .update(finalUpdates)
    .eq('user_id', userId)
    .eq('provider', 'strava')

  return { done, savedThisTick, rateLimited }
}
