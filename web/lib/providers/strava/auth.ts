const STRAVA_SCOPES = 'activity:read_all,profile:read_all'

export function buildStravaAuthUrl(redirectUri: string, state: string): string {
  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id',       process.env.STRAVA_CLIENT_ID!)
  url.searchParams.set('response_type',   'code')
  url.searchParams.set('redirect_uri',    redirectUri)
  url.searchParams.set('approval_prompt', 'force')
  url.searchParams.set('scope',           STRAVA_SCOPES)
  url.searchParams.set('state',           state)
  return url.toString()
}

export async function exchangeStravaCode(code: string): Promise<StravaTokenResponse> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Strava token exchange: ${res.status} ${await res.text()}`)
  return res.json()
}

export type StravaTokenResponse = {
  access_token:  string
  refresh_token: string
  expires_at:    number
  athlete: {
    id:        number
    firstname: string
    lastname:  string
    profile:   string
  }
}
