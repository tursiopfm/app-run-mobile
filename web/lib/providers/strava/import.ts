import { fetchStravaActivitiesPage } from './api'
import { getValidStravaToken } from './token'
import { stravaToNormalized } from './mapper'
import { importActivities } from '@/lib/sync/import-activities'
import { createServiceClient } from '@/lib/database/supabase-server'
import type { StravaActivity } from './mapper'

const PAGE_SIZE = 200

export type TickResult = {
  done: boolean
  savedThisTick: number
  rateLimited: boolean
}

export async function processOneImportTick(userId: string): Promise<TickResult> {
  const supabase = createServiceClient()

  // Lire le curseur courant
  const { data: connection, error: connErr } = await supabase
    .from('provider_connections')
    .select('import_oldest_at')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .single()

  if (connErr || !connection) {
    throw new Error('No Strava connection found for user')
  }

  const oldestAt = (connection as { import_oldest_at: string | null }).import_oldest_at
  const before = oldestAt ? Math.floor(new Date(oldestAt).getTime() / 1000) : undefined

  // Marquer in_progress (anti-chevauchement via updated_at)
  await supabase
    .from('provider_connections')
    .update({
      import_status: 'in_progress',
      import_updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava')

  let batch: StravaActivity[]
  try {
    const token = await getValidStravaToken(userId)
    batch = await fetchStravaActivitiesPage(token, 1, { before, perPage: PAGE_SIZE })
  } catch (err) {
    if ((err as { rateLimited?: boolean }).rateLimited) {
      // 429: garder status pending, retry au prochain tick
      await supabase
        .from('provider_connections')
        .update({
          import_status: 'pending',
          import_updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('provider', 'strava')
      return { done: false, savedThisTick: 0, rateLimited: true }
    }
    // Autre erreur: marquer error et rethrow
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

  // Cas batch vide: terminé
  if (batch.length === 0) {
    await supabase
      .from('provider_connections')
      .update({
        import_status: 'completed',
        import_completed_at: new Date().toISOString(),
        import_updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'strava')
    return { done: true, savedThisTick: 0, rateLimited: false }
  }

  // Charger profil pour CES
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')
    .eq('id', userId)
    .single()
  const profile = (profileRow as Record<string, number | null> | null) ?? {}

  // Mapper + importer
  const normalized = batch.map((a) => stravaToNormalized(userId, a))
  const importResult = await importActivities(normalized, profile)

  // Calculer nouveau curseur (plus ancienne activité du batch)
  const newOldestUnix = batch.reduce((min, a) => {
    const t = new Date(a.start_date).getTime()
    return t < min ? t : min
  }, Number.POSITIVE_INFINITY)
  const newOldestIso = new Date(newOldestUnix).toISOString()

  const isComplete = batch.length < PAGE_SIZE
  const now = new Date().toISOString()

  // Mettre à jour curseur, total, status final
  const updates: Record<string, unknown> = {
    import_oldest_at: newOldestIso,
    import_updated_at: now,
  }
  // Incrémenter total via SQL: on lit + écrit. Ici on fait simple: select courant + update.
  const { data: currentRow } = await supabase
    .from('provider_connections')
    .select('import_total')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .single()
  const currentTotal = (currentRow as { import_total: number } | null)?.import_total ?? 0
  updates.import_total = currentTotal + importResult.saved

  if (isComplete) {
    updates.import_status = 'completed'
    updates.import_completed_at = now
  }

  await supabase
    .from('provider_connections')
    .update(updates)
    .eq('user_id', userId)
    .eq('provider', 'strava')

  return { done: isComplete, savedThisTick: importResult.saved, rateLimited: false }
}
