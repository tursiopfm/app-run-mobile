import { NextRequest, NextResponse } from 'next/server'
import { exchangeStravaCode } from '@/lib/providers/strava/auth'
import { createClient } from '@/lib/database/supabase-server'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

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

    await supabase.from('provider_connections').upsert({
      user_id:         user.id,
      provider:        'strava',
      provider_user_id:String(tokens.athlete.id),
      access_token:    tokens.access_token,
      refresh_token:   tokens.refresh_token,
      token_expires_at:new Date(tokens.expires_at * 1000).toISOString(),
      scope:           'activity:read_all,profile:read_all',
      athlete_data:    tokens.athlete,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

    return NextResponse.redirect(`${APP_URL}/settings?strava=connected`)
  } catch (e) {
    console.error('Strava callback error:', e)
    return NextResponse.redirect(`${APP_URL}/settings?strava=error`)
  }
}
