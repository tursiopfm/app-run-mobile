import 'server-only'
import { gzipSync, gunzipSync } from 'node:zlib'
import type { RaceTrack } from '@/types/plan'
import type { DenseProfile } from './resample'

export function encodeProfile(p: DenseProfile): string {
  return gzipSync(Buffer.from(JSON.stringify(p))).toString('base64')
}
export function decodeProfile(s: string): DenseProfile {
  return JSON.parse(gunzipSync(Buffer.from(s, 'base64')).toString('utf8')) as DenseProfile
}

export function rowToRaceTrack(row: any): RaceTrack {
  return {
    raceId: row.race_id,
    profile: decodeProfile(row.profile_gz),
    pointCount: row.point_count,
    source: row.source,
    distanceM: row.distance_m ?? null,
    createdAt: row.created_at,
  }
}

export async function upsertRaceTrack(
  supabase: any,
  raceId: string,
  args: { profile: DenseProfile; source: RaceTrack['source']; distanceM: number | null },
): Promise<void> {
  const { error } = await supabase.from('race_tracks').upsert({
    race_id: raceId,
    profile_gz: encodeProfile(args.profile),
    point_count: args.profile.d.length,
    source: args.source,
    distance_m: args.distanceM,
    created_at: new Date().toISOString(),
  }, { onConflict: 'race_id' })
  if (error) throw new Error(error.message)
}

export async function getRaceTrack(supabase: any, raceId: string): Promise<RaceTrack | null> {
  const { data } = await supabase.from('race_tracks').select('*').eq('race_id', raceId).maybeSingle()
  return data ? rowToRaceTrack(data) : null
}
