import type { Metadata } from 'next'
import { CockpitMissionPreview } from '@/components/cockpit/mission-preview/CockpitMissionPreview'

// Route de PREVIEW du Cockpit « Mode Mission ».
// Isolée : pas d'auth, pas de persistance, données mockées.
// Le dashboard de production (/dashboard) reste inchangé.
export const metadata: Metadata = {
  title: 'Cockpit — Mode Mission (Preview)',
  robots: { index: false, follow: false },
}

export default function CockpitMissionPreviewPage() {
  return <CockpitMissionPreview />
}
