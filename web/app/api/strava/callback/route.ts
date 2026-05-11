import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { waitUntil } from '@vercel/functions'
import { exchangeStravaCode } from '@/lib/providers/strava/auth'
import { createClient } from '@/lib/database/supabase-server'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const savedState  = cookieStore.get('strava_oauth_state')?.value

  if (!state || !savedState || state !== savedState) {
    cookieStore.delete('strava_oauth_state')
    return NextResponse.redirect(`${APP_URL}/settings?strava=error`)
  }
  cookieStore.delete('strava_oauth_state')

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/settings?strava=error`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/settings?strava=unauthenticated`)
  }

  try {
    const tokens = await exchangeStravaCode(code)

    const now = new Date().toISOString()
    await supabase.from('provider_connections').upsert({
      user_id:         user.id,
      provider:        'strava',
      provider_user_id:String(tokens.athlete.id),
      access_token:    tokens.access_token,
      refresh_token:   tokens.refresh_token,
      token_expires_at:new Date(tokens.expires_at * 1000).toISOString(),
      scope:           'activity:read_all,profile:read_all',
      athlete_data:    tokens.athlete,
      updated_at:      now,
      import_status:   'pending',
      import_started_at: now,
      import_completed_at: null,
      import_oldest_at: null,
      import_total:    0,
      import_last_error: null,
      import_updated_at: null,
    }, { onConflict: 'user_id,provider' })

    // Trigger immédiat du premier tick d'import (background via waitUntil).
    // L'user voit les premières activités dès l'arrivée sur le dashboard,
    // sans attendre le prochain tick GitHub Actions (5 min).
    // waitUntil garde la fonction serverless en vie jusqu'à la fin du fetch
    // (fire-and-forget pur ne marche pas sur Vercel — la fonction est tuée).
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      waitUntil(
        fetch(`${APP_URL}/api/cron/strava-import`, {
          headers: { Authorization: `Bearer ${cronSecret}` },
        }).catch((err) => console.error('[callback] cron trigger failed:', err))
      )
    }

    return NextResponse.redirect(`${APP_URL}/settings?strava=connected`)
  } catch (e) {
    console.error('Strava callback error:', e)
    return NextResponse.redirect(`${APP_URL}/settings?strava=error`)
  }
}
