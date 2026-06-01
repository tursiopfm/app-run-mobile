import { stravaCallbackRedirects } from '@/lib/providers/strava/auth'

describe('stravaCallbackRedirects', () => {
  const APP = 'https://app.test'

  it('origine onboarding → dashboard (succès), onboarding (erreur + déjà lié)', () => {
    const { okUrl, errUrl, alreadyLinkedUrl } = stravaCallbackRedirects('onboarding', APP)
    expect(okUrl).toBe('https://app.test/dashboard?strava=connected')
    expect(errUrl).toBe('https://app.test/onboarding?strava=error')
    expect(alreadyLinkedUrl).toBe('https://app.test/onboarding?strava=already_linked')
  })

  it('origine par défaut (undefined) → settings (succès, erreur, déjà lié)', () => {
    const { okUrl, errUrl, alreadyLinkedUrl } = stravaCallbackRedirects(undefined, APP)
    expect(okUrl).toBe('https://app.test/settings?strava=connected')
    expect(errUrl).toBe('https://app.test/settings?strava=error')
    expect(alreadyLinkedUrl).toBe('https://app.test/settings?strava=already_linked')
  })

  it('origine inconnue → settings (pas de match onboarding)', () => {
    const { okUrl, errUrl, alreadyLinkedUrl } = stravaCallbackRedirects('whatever', APP)
    expect(okUrl).toBe('https://app.test/settings?strava=connected')
    expect(errUrl).toBe('https://app.test/settings?strava=error')
    expect(alreadyLinkedUrl).toBe('https://app.test/settings?strava=already_linked')
  })
})
