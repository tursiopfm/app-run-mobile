import { NextRequest, NextResponse } from 'next/server'
import { buildStravaAuthUrl } from '@/lib/providers/strava/auth'
import { createClient } from '@/lib/database/supabase-server'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/settings', process.env.APP_URL!))
  }

  const from        = request.nextUrl.searchParams.get('from')
  const state       = randomBytes(16).toString('hex')
  const redirectUri = process.env.STRAVA_REDIRECT_URI!
  const authUrl     = buildStravaAuthUrl(redirectUri, state)

  const response = NextResponse.redirect(authUrl)
  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   600,
  }
  response.cookies.set('strava_oauth_state', state, cookieOpts)
  if (from === 'onboarding') {
    response.cookies.set('strava_from', 'onboarding', cookieOpts)
  }
  return response
}
