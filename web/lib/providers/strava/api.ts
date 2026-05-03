import type { StravaActivity } from './mapper'

const STRAVA_BASE = 'https://www.strava.com/api/v3'

export type FetchActivitiesOptions = {
  after?: number
  perPage?: number
  page?: number
}

export async function fetchStravaActivities(
  accessToken: string,
  options: FetchActivitiesOptions = {}
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    per_page: String(options.perPage ?? 200),
    page: String(options.page ?? 1),
    ...(options.after !== undefined ? { after: String(options.after) } : {}),
  })

  const res = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)

  return res.json() as Promise<StravaActivity[]>
}
