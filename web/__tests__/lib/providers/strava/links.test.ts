import { stravaActivityUrl } from '@/lib/providers/strava/links'

describe('stravaActivityUrl', () => {
  it('builds the public activity deep link', () => {
    expect(stravaActivityUrl('14782931045')).toBe('https://www.strava.com/activities/14782931045')
  })

  it('accepts a numeric id', () => {
    expect(stravaActivityUrl(123)).toBe('https://www.strava.com/activities/123')
  })
})
