import { gzipSync, gunzipSync } from 'zlib'
import type { StreamSet } from '@/lib/activities/stream-metrics'

const STRAVA_BASE = 'https://www.strava.com/api/v3'
const STREAM_KEYS = 'time,altitude,heartrate,velocity_smooth,distance,grade_smooth'

// Downsample par fenêtre de `everyS` secondes (1er point de chaque fenêtre),
// en garantissant la présence du dernier point pour l'exactitude des bornes.
export function downsampleStreams(s: StreamSet, everyS = 5): StreamSet {
  const t = s.time
  if (!t || t.length === 0) return s
  const keep: number[] = []
  let nextBucket = -Infinity
  for (let i = 0; i < t.length; i++) {
    if (t[i] >= nextBucket) { keep.push(i); nextBucket = t[i] + everyS }
  }
  if (keep[keep.length - 1] !== t.length - 1) keep.push(t.length - 1)
  const pick = (arr?: number[]) => (arr ? keep.map((i) => arr[i]) : undefined)
  return {
    time:      pick(s.time),
    altitude:  pick(s.altitude),
    heartrate: pick(s.heartrate),
    velocity:  pick(s.velocity),
    distance:  pick(s.distance),
    grade:     pick(s.grade),
  }
}

export function packStreams(s: StreamSet): string {
  return gzipSync(Buffer.from(JSON.stringify(s))).toString('base64')
}

export function unpackStreams(b64: string): StreamSet {
  return JSON.parse(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8')) as StreamSet
}

type StravaStreamResponse = Record<string, { data: number[] } | undefined>

export async function fetchStravaStreams(
  accessToken: string,
  activityId: string | number,
): Promise<StreamSet> {
  const params = new URLSearchParams({ keys: STREAM_KEYS, key_by_type: 'true' })
  const res = await fetch(`${STRAVA_BASE}/activities/${activityId}/streams?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 429) {
    const err = new Error('Strava rate limit (429)') as Error & { rateLimited: true }
    err.rateLimited = true
    throw err
  }
  if (res.status === 404) return {} // activité manuelle / sans capteur → pas de streams
  if (!res.ok) throw new Error(`Strava streams error: ${res.status}`)

  const json = (await res.json()) as StravaStreamResponse
  return {
    time:      json.time?.data,
    altitude:  json.altitude?.data,
    heartrate: json.heartrate?.data,
    velocity:  json.velocity_smooth?.data,
    distance:  json.distance?.data,
    grade:     json.grade_smooth?.data,
  }
}
