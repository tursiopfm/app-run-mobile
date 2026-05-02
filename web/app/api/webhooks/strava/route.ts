import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database/supabase-server'
import type { StravaWebhookEvent } from '@/lib/providers/strava/webhook'

// GET: Strava hub challenge validation
export async function GET(request: NextRequest) {
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) return NextResponse.json({ error: 'webhook not configured' }, { status: 500 })

  const { searchParams } = request.nextUrl
  const mode      = searchParams.get('hub.mode')
  const challenge = searchParams.get('hub.challenge')
  const token     = searchParams.get('hub.verify_token')

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

// POST: receive Strava push event
export async function POST(request: NextRequest) {
  // Respond immediately — Strava requires < 2s response
  const supabase = createServiceClient()

  let event: StravaWebhookEvent
  try {
    event = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  // Fire-and-forget: store raw event + enqueue sync job
  Promise.resolve().then(async () => {
    try {
      const { data: webhookRow } = await supabase
        .from('webhook_events')
        .insert({
          provider:    'strava',
          event_type:  event.aspect_type,
          object_type: event.object_type,
          object_id:   String(event.object_id),
          owner_id:    String(event.owner_id),
          raw_payload: event,
        })
        .select('id')
        .single()

      if (event.object_type === 'activity') {
        await supabase.from('sync_jobs').insert({
          provider:  'strava',
          job_type:  `activity_${event.aspect_type}`,
          status:    'pending',
          payload: {
            activityId:     event.object_id,
            athleteId:      event.owner_id,
            webhookEventId: webhookRow?.id,
          },
        })
      }
    } catch (e) {
      console.error('Webhook processing error:', e)
    }
  })

  return NextResponse.json({ ok: true })
}
