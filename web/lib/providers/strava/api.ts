import type { StravaActivity } from './mapper'

const STRAVA_BASE = 'https://www.strava.com/api/v3'
const PER_PAGE = 200

export type FetchActivitiesOptions = {
  after?: number
  before?: number
  maxActivities?: number
}

export type FetchPageOptions = {
  after?: number
  before?: number
  perPage?: number
}

export async function fetchStravaActivitiesPage(
  accessToken: string,
  page: number,
  options: FetchPageOptions = {}
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    per_page: String(options.perPage ?? PER_PAGE),
    page: String(page),
    ...(options.after !== undefined ? { after: String(options.after) } : {}),
    ...(options.before !== undefined ? { before: String(options.before) } : {}),
  })

  const res = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 429) {
    const err = new Error('Strava rate limit (429)') as Error & { rateLimited: true }
    err.rateLimited = true
    throw err
  }

  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)

  return res.json() as Promise<StravaActivity[]>
}

export async function fetchStravaActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivity> {
  const res = await fetch(`${STRAVA_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)
  return res.json() as Promise<StravaActivity>
}

export async function fetchStravaActivities(
  accessToken: string,
  options: FetchActivitiesOptions = {}
): Promise<StravaActivity[]> {
  const max = options.maxActivities ?? 1000
  const all: StravaActivity[] = []
  let page = 1

  while (all.length < max) {
    const batch = await fetchStravaActivitiesPage(accessToken, page, {
      after: options.after,
      before: options.before,
    })
    all.push(...batch)
    if (batch.length < PER_PAGE) break
    page++
  }

  return all.slice(0, max)
}
