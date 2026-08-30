// web/lib/garmin-import/enrich-commit.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StreamUpload } from './enrich-types'
import { unpackStreams } from '@/lib/providers/strava/streams'
import { computeHrTimeHistogram } from '@/lib/health/hr-zones'

// Histogramme FC depuis un stream déjà compressé (le client envoie du gz).
// Renvoie toujours un tableau : [] signifie « traité, pas de cardio exploitable »,
// à distinguer de null (« pas encore backfillé », cf. migration 047).
function hrHistFromGz(streamsGz: string): number[] {
  try {
    const s = unpackStreams(streamsGz)
    if (!s.heartrate?.length || !s.time?.length) return []
    return computeHrTimeHistogram(s.heartrate, s.time)
  } catch {
    return []
  }
}

export async function writeStreamRows(
  supabase: SupabaseClient, userId: string, uploads: StreamUpload[],
): Promise<number> {
  if (uploads.length === 0) return 0
  // Deux .fit peuvent matcher la même activité (fichiers multiples côté Garmin) → dédupe
  // par activity_id en gardant le plus riche, sinon Postgres rejette tout le batch :
  // "ON CONFLICT DO UPDATE command cannot affect row a second time".
  const byActivity = new Map<string, StreamUpload>()
  for (const u of uploads) {
    const prev = byActivity.get(u.activityId)
    if (!prev || u.pointCount > prev.pointCount) byActivity.set(u.activityId, u)
  }
  const rows = Array.from(byActivity.values()).map(u => ({
    activity_id: u.activityId, user_id: userId, downsample_s: 5,
    point_count: u.pointCount, streams_gz: u.streamsGz, source: 'garmin',
    // Dérivé à l'écriture : évite de relire streams_gz au recalcul CES (cf. 047).
    // Le client le calcule déjà quand le stream est encore décompressé ; sinon on
    // décompresse ici.
    hr_time_hist: u.hrTimeHist ?? hrHistFromGz(u.streamsGz),
  }))
  const { error } = await supabase.from('activity_streams').upsert(rows, { onConflict: 'activity_id' })
  if (error) throw new Error(`Garmin streams upsert: ${error.message}`)
  return rows.length
}

/**
 * Fusionne la carte (polyline) et les splits/km dérivés du FIT dans raw_payload des
 * activités, sans écraser le reste (source, summary). Permet à la page détail d'afficher
 * carte + splits sans modification (mêmes champs map.summary_polyline / splits_metric que Strava).
 */
export async function mergeMapAndSplits(
  supabase: SupabaseClient, userId: string, uploads: StreamUpload[],
): Promise<number> {
  const withData = uploads.filter(u => u.summaryPolyline || (u.splits && u.splits.length))
  if (withData.length === 0) return 0
  // Dédupe par activity_id (garder le plus riche), cohérent avec writeStreamRows.
  const byActivity = new Map<string, StreamUpload>()
  for (const u of withData) {
    const prev = byActivity.get(u.activityId)
    if (!prev || u.pointCount > prev.pointCount) byActivity.set(u.activityId, u)
  }
  const items = Array.from(byActivity.values())
  const ids = items.map(i => i.activityId)

  const { data } = await supabase
    .from('activities').select('id, raw_payload').in('id', ids).eq('user_id', userId)
  const rawById = new Map<string, Record<string, unknown>>(
    (data ?? []).map((r) => {
      const row = r as { id: string; raw_payload?: Record<string, unknown> | null }
      return [String(row.id), row.raw_payload ?? {}]
    }),
  )

  let n = 0
  await Promise.all(items.map(async (u) => {
    const raw = { ...(rawById.get(u.activityId) ?? {}) } as Record<string, unknown>
    if (u.summaryPolyline) {
      raw.map = { ...((raw.map as Record<string, unknown>) ?? {}), summary_polyline: u.summaryPolyline }
    }
    if (u.splits && u.splits.length) raw.splits_metric = u.splits
    const { error } = await supabase
      .from('activities').update({ raw_payload: raw }).eq('id', u.activityId).eq('user_id', userId)
    if (!error) n++
  }))
  return n
}
