// web/lib/garmin-import/enrich-commit.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StreamUpload } from './enrich-types'

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
  }))
  const { error } = await supabase.from('activity_streams').upsert(rows, { onConflict: 'activity_id' })
  if (error) throw new Error(`Garmin streams upsert: ${error.message}`)
  return rows.length
}
