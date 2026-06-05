// web/app/design-system/og/page.tsx
// Route de capture OG uniquement (preview) — rend la carte 1200×630 sans contrainte
// de largeur de la page design-system. Sert à générer public/brand-preview/og-default.png.
import { OgCard } from '@/components/brand/OgCard'

export default function OgCapturePage() {
  return (
    <main style={{ width: 1200, height: 630 }}>
      <OgCard />
    </main>
  )
}
