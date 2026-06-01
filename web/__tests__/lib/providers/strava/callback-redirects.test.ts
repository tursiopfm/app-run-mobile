import { stravaCallbackRedirects } from '@/lib/providers/strava/auth'

describe('stravaCallbackRedirects', () => {
  const APP = 'https://app.test'

  it('origine onboarding → dashboard (succès) et onboarding (erreur)', () => {
    const { okUrl, errUrl } = stravaCallbackRedirects('onboarding', APP)
    expect(okUrl).toBe('https://app.test/dashboard?strava=connected')
    expect(errUrl).toBe('https://app.test/onboarding?strava=error')
  })

  it('origine par défaut (undefined) → settings (succès et erreur)', () => {
    const { okUrl, errUrl } = stravaCallbackRedirects(undefined, APP)
    expect(okUrl).toBe('https://app.test/settings?strava=connected')
    expect(errUrl).toBe('https://app.test/settings?strava=error')
  })

  it('origine inconnue → settings (pas de match onboarding)', () => {
    const { okUrl, errUrl } = stravaCallbackRedirects('whatever', APP)
    expect(okUrl).toBe('https://app.test/settings?strava=connected')
    expect(errUrl).toBe('https://app.test/settings?strava=error')
  })
})
