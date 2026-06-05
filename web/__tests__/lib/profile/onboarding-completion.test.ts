// web/__tests__/lib/profile/onboarding-completion.test.ts
import { onboardingCompletionPatch } from '@/lib/profile/onboarding-completion'

describe('onboardingCompletionPatch', () => {
  it('pose onboarding_completed_at (ISO) quand onboarding_complete === true', () => {
    const patch = onboardingCompletionPatch({ onboarding_complete: true })
    expect(typeof patch.onboarding_completed_at).toBe('string')
    expect(new Date(patch.onboarding_completed_at as string).toISOString())
      .toBe(patch.onboarding_completed_at)
  })

  it('ne pose rien quand le flag est absent ou falsy', () => {
    expect(onboardingCompletionPatch({})).toEqual({})
    expect(onboardingCompletionPatch({ onboarding_complete: false })).toEqual({})
    expect(onboardingCompletionPatch({ onboarding_complete: 'true' as unknown as boolean })).toEqual({})
  })
})
