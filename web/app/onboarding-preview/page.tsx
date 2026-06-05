import type { Metadata } from 'next'
import { MissionSetupFlow } from '@/components/onboarding/mission-setup/MissionSetupFlow'

// Route de PREVIEW du nouvel onboarding « Mission Setup ».
// Isolée : pas d'auth, pas de redirection, aucune persistance.
// L'onboarding de production reste à /onboarding (inchangé).
export const metadata: Metadata = {
  title: 'Mission Setup — Preview',
  robots: { index: false, follow: false },
}

export default function OnboardingPreviewPage() {
  return <MissionSetupFlow />
}
