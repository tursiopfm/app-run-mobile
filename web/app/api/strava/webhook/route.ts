import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/database/supabase-server'
import { fetchStravaActivity } from '@/lib/providers/strava/api'
import { stravaToNormalized } from '@/lib/providers/strava/mapper'
import { importActivities } from '@/lib/sync/import-activities'
import type { StravaWebhookEvent } from '@/lib/providers/strava/webhook'

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN!

// GET: Strava webhook subscription verification
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

// POST: Receive Strava webhook events — respond immediately, process in background
export async function POST(request: NextRequest) {
  const event = (await request.json()) as StravaWebhookEvent

  if (event.object_type !== 'activity') {
    return NextResponse.json({ ok: true })
  }

  // Return 200 immediately (Strava requires < 2s), process in background
  waitUntil(processActivityEvent(event))

  return NextResponse.json({ ok: true })
}

async function processActivityEvent(event: StravaWebhookEvent) {
  const supabase = createServiceClient()

  const { data: conn } = await supabase
    .from('provider_connections')
    .select('user_id, access_token, refresh_token, token_expires_at')
    .eq('provider', 'strava')
    .eq('provider_user_id', String(event.owner_id))
    .single()

  if (!conn) return

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

  try {
    const accessToken = await resolveAccessToken(supabase, userId, conn as ConnectionRow)
    const stravaActivity = await fetchStravaActivity(accessToken, event.object_id)
    const normalized = stravaToNormalized(userId, stravaActivity)
    await importActivities([normalized])
  } catch (err) {
    console.error('[strava-webhook] sync error:', err)
  }
}

type ConnectionRow = {
  access_token: string
  refresh_token: string
  token_expires_at: string
}

async function resolveAccessToken(
  supabase: ReturnType<typeof createServiceClient>,
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
