import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchStravaActivity } from '@/lib/providers/strava/api'
import { stravaToNormalized } from '@/lib/providers/strava/mapper'
import { computeCesResult } from '@/lib/analytics/effort-score'
import type { StravaWebhookEvent } from '@/lib/providers/strava/webhook'
import type { ActivityInput } from '@/lib/analytics/types'
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

export const runtime = 'edge'

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN!

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function resolveUserId(stravaAthleteId: number, client: ReturnType<typeof serviceClient>) {
  const { data } = await client
    .from('provider_connections')
    .select('user_id')
    .eq('provider', 'strava')
    .eq('provider_user_id', String(stravaAthleteId))
    .single()
  return data?.user_id ?? null
}

export async function GET(request: NextRequest) {
  const params    = request.nextUrl.searchParams
  const mode      = params.get('hub.mode')
  const token     = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST: process synchronously within Strava's 2s window.
// On failure, return 500 — Strava retries (1min, 5min, 30min schedule).
export async function POST(request: NextRequest) {
  const event = (await request.json()) as StravaWebhookEvent

  console.log('[webhook-recv]', event.object_type, event.aspect_type, event.object_id, event.owner_id)

  if (event.object_type !== 'activity') {
    // Log non-activity events too
    try {
      const client = serviceClient()
      await client.from('webhook_logs').insert({
        provider: 'strava',
        event_type: event.aspect_type ? `${event.object_type}.${event.aspect_type}` : (event.object_type ?? 'unknown'),
        user_id: event.owner_id ? await resolveUserId(Number(event.owner_id), client) : null,
        status_code: 200,
        payload: event,
      })
    } catch {
      // logging failure should not affect webhook response
    }
    return NextResponse.json({ ok: true })
  }

  let statusCode = 200
  try {
    await processActivityEvent(event)
  } catch (err) {
    console.error('[webhook-err]', event.object_id, String(err))
    statusCode = 500
  }

  // Log webhook event
  try {
    const client = serviceClient()
    await client.from('webhook_logs').insert({
      provider: 'strava',
      event_type: event.aspect_type ? `${event.object_type}.${event.aspect_type}` : (event.object_type ?? 'unknown'),
      user_id: event.owner_id ? await resolveUserId(Number(event.owner_id), client) : null,
      status_code: statusCode,
      payload: event,
    })
  } catch {
    // logging failure should not affect webhook response
  }

  if (statusCode !== 200) {
    return NextResponse.json({ error: 'processing failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

async function processActivityEvent(event: StravaWebhookEvent) {
  const supabase = serviceClient()

  const { data: conn, error: connErr } = await supabase
    .from('provider_connections')
    .select('user_id, access_token, refresh_token, token_expires_at')
    .eq('provider', 'strava')
    .eq('provider_user_id', String(event.owner_id))
    .single()

  if (connErr) throw new Error(`conn lookup: ${connErr.message}`)
  if (!conn) throw new Error(`no connection for owner ${event.owner_id}`)

  const userId = conn.user_id as string

  if (event.aspect_type === 'delete') {
    await supabase
      .from('activities')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'strava')
      .eq('provider_activity_id', String(event.object_id))
    return
  }

  const accessToken = await resolveAccessToken(supabase, userId, conn as ConnectionRow)

  // One quick retry inside the 2s window for the "activity not ready" race
  let stravaActivity
  try {
    stravaActivity = await fetchStravaActivity(accessToken, event.object_id)
  } catch (err) {
    await new Promise(r => setTimeout(r, 500))
    stravaActivity = await fetchStravaActivity(accessToken, event.object_id)
  }

  const normalized = stravaToNormalized(userId, stravaActivity)
  await upsertActivity(supabase, normalized)
  console.log('[webhook-ok]', event.object_id)
}

async function upsertActivity(
  supabase: ReturnType<typeof serviceClient>,
  act: NormalizedActivity
) {
  const input: ActivityInput = {
    id: act.providerActivityId,
    rawSportType: act.sportType,
    name: act.name,
    startDate: act.startTime,
    movingTimeSeconds: act.movingTimeSec,
    elapsedTimeSeconds: act.durationSec,
    distanceMeters: act.distanceM,
    elevationGainMeters: act.elevationGainM,
    averageHeartrate: act.avgHr ?? undefined,
    maxHeartrate: act.maxHr ?? undefined,
    averageWatts: act.avgPower ?? undefined,
    calories: act.calories ?? undefined,
  }
  const ces = computeCesResult(input)

  const { data: rows, error } = await supabase
    .from('activities')
    .upsert({
      user_id: act.userId,
      provider: act.provider,
      provider_activity_id: act.providerActivityId,
      sport_type: act.sportType,
      name: act.name,
      start_time: act.startTime,
      duration_sec: act.durationSec,
      moving_time_sec: act.movingTimeSec,
      distance_m: act.distanceM,
      elevation_gain_m: act.elevationGainM,
      avg_hr: act.avgHr,
      max_hr: act.maxHr,
      avg_power: act.avgPower,
      calories: act.calories,
      external_training_load: act.externalTrainingLoad,
      ces: ces.ces,
      raw_payload: act.rawPayload,
    }, { onConflict: 'user_id,provider,provider_activity_id' })
    .select('id, provider_activity_id')

  if (error) throw new Error(`Activity upsert failed: ${error.message}`)
  if (!rows?.length) return

  await supabase.from('activity_metrics').upsert([
    { activity_id: rows[0].id, metric_key: 'ces',              metric_value: ces.ces },
    { activity_id: rows[0].id, metric_key: 'cardio_load',      metric_value: ces.cardioLoad },
    { activity_id: rows[0].id, metric_key: 'muscle_load',      metric_value: ces.muscleLoad },
    { activity_id: rows[0].id, metric_key: 'intensity_factor', metric_value: ces.intensityFactor },
  ], { onConflict: 'activity_id,metric_key' })
}

type ConnectionRow = { access_token: string; refresh_token: string; token_expires_at: string }

async function resolveAccessToken(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  conn: ConnectionRow
): Promise<string> {
  const expiresAt = new Date(conn.token_expires_at).getTime()
  if (Date.now() < expiresAt - 300_000) return conn.access_token

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: conn.refresh_token,
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const json = await res.json() as { access_token: string; refresh_token: string; expires_at: number }

  await supabase
    .from('provider_connections')
    .update({
      access_token:     json.access_token,
      refresh_token:    json.refresh_token,
      token_expires_at: new Date(json.expires_at * 1000).toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava')

  return json.access_token
}
