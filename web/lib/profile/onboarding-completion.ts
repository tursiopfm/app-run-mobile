// web/lib/profile/onboarding-completion.ts

// Décide le timestamp serveur de complétion d'onboarding.
// Strict `=== true` : on n'accepte jamais un timestamp fourni par le client.
export function onboardingCompletionPatch(
  body: { onboarding_complete?: unknown },
): { onboarding_completed_at?: string } {
  return body.onboarding_complete === true
    ? { onboarding_completed_at: new Date().toISOString() }
    : {}
}
