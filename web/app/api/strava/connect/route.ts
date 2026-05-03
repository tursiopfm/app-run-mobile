import { NextResponse } from 'next/server'
import { buildStravaAuthUrl } from '@/lib/providers/strava/auth'
import { createClient } from '@/lib/database/supabase-server'
import { randomBytes } from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/settings', process.env.APP_URL!))
  }

  const state       = randomBytes(16).toString('hex')
  const redirectUri = process.env.STRAVA_REDIRECT_URI!
  const authUrl     = buildStravaAuthUrl(redirectUri, state)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('strava_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600,
  })
  return response
}
