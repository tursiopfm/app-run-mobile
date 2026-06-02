const STRAVA_SCOPES = 'activity:read_all,activity:write,profile:read_all'

// Strava attend les identifiants client dans le BODY du form (champs
// client_id / client_secret), PAS dans un en-tête Authorization: Basic —
// l'endpoint oauth/token rejette le Basic avec « client_id invalid »
// (vérifié contre l'API live le 2026-06-02). À spreader dans le URLSearchParams.
export function stravaClientCreds(): { client_id: string; client_secret: string } {
  return {
    client_id:     process.env.STRAVA_CLIENT_ID ?? '',
    client_secret: process.env.STRAVA_CLIENT_SECRET ?? '',
  }
}

// Destinations de redirection après le callback OAuth, selon l'origine du flux.
// `from === 'onboarding'` ramène sur le dashboard (succès) ou réaffiche
// l'onboarding (erreur) ; sinon retour aux Réglages (comportement historique).
export function stravaCallbackRedirects(
  from: string | undefined,
  appUrl: string,
): { okUrl: string; errUrl: string; alreadyLinkedUrl: string } {
  const onboarding = from === 'onboarding'
  const base = onboarding ? '/onboarding' : '/settings'
  return {
    okUrl:            onboarding ? `${appUrl}/dashboard?strava=connected` : `${appUrl}/settings?strava=connected`,
    errUrl:           `${appUrl}${base}?strava=error`,
    alreadyLinkedUrl: `${appUrl}${base}?strava=already_linked`,
  }
}

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
      ...stravaClientCreds(),
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Strava token exchange: ${res.status} ${await res.text()}`)
  return res.json()
}

// Révoque un token côté Strava via le nouvel endpoint oauth/revoke
// (oauth/deauthorize est retiré le 2027-06-01). Lève si !res.ok, l'appelant catche.
export async function revokeStravaToken(token: string): Promise<void> {
  const res = await fetch('https://www.strava.com/oauth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...stravaClientCreds(), token }),
  })
  if (!res.ok) throw new Error(`Strava revoke error: ${res.status}`)
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
