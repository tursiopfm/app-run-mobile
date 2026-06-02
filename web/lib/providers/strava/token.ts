import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/database/supabase-server'
import { stravaClientCreds } from './auth'

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const BUFFER_MS = 300 * 1000 // refresh 5 minutes before expiry

// Use service-role client: callers always pass an explicit userId, and the cron
// runs without a user session. RLS would block the user-scoped client.
export async function getValidStravaToken(userId: string): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('provider_connections')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .single()

  if (error || !data) throw new Error('No Strava connection found for user')

  const expiresAt = new Date(data.token_expires_at as string).getTime()
  if (Date.now() < expiresAt - BUFFER_MS) return data.access_token as string

  return _refreshToken(supabase, userId, data.refresh_token as string)
}

async function _refreshToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...stravaClientCreds(),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`)

  const json = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_at: number
  }

  await supabase
    .from('provider_connections')
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      token_expires_at: new Date(json.expires_at * 1000).toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava')

  return json.access_token
}
