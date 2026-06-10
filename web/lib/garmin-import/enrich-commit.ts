// web/lib/garmin-import/enrich-commit.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StreamUpload } from './enrich-types'

export async function writeStreamRows(
  supabase: SupabaseClient, userId: string, uploads: StreamUpload[],
): Promise<number> {
  if (uploads.length === 0) return 0
  const rows = uploads.map(u => ({
    activity_id: u.activityId, user_id: userId, downsample_s: 5,
    point_count: u.pointCount, streams_gz: u.streamsGz, source: 'garmin',
  }))
  const { error } = await supabase.from('activity_streams').upsert(rows, { onConflict: 'activity_id' })
  if (error) throw new Error(`Garmin streams upsert: ${error.message}`)
  return rows.length
}
