import type { StravaActivity } from './mapper'

const STRAVA_BASE = 'https://www.strava.com/api/v3'
const PER_PAGE = 200

export type FetchActivitiesOptions = {
  after?: number
  maxActivities?: number
}

async function fetchPage(
  accessToken: string,
  page: number,
  after?: number
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    per_page: String(PER_PAGE),
    page: String(page),
    ...(after !== undefined ? { after: String(after) } : {}),
  })

  const res = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)

  return res.json() as Promise<StravaActivity[]>
}

export async function fetchStravaActivities(
  accessToken: string,
  options: FetchActivitiesOptions = {}
): Promise<StravaActivity[]> {
  const max = options.maxActivities ?? 1000
  const all: StravaActivity[] = []
  let page = 1

  while (all.length < max) {
    const batch = await fetchPage(accessToken, page, options.after)
    all.push(...batch)
    if (batch.length < PER_PAGE) break
    page++
  }

  return all.slice(0, max)
}
