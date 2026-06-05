// web/components/ui/SplashVisual.tsx
// Visuel du splash (logo stacked + tagline) partagé par l'overlay au lancement
// (SplashScreen) et la route de démarrage /launch → rendu identique, zéro drift.
import { LogoTrailCockpit } from '@/components/brand/LogoTrailCockpit'

export function SplashVisual() {
  return (
    <div className="flex flex-col items-center justify-center gap-7">
      <LogoTrailCockpit variant="stacked" tone="brand" size={88} />
      <p className="font-display text-[14px] tracking-[0.02em]" style={{ color: '#8BA8A3' }}>
        Préparer. Piloter. Accomplir.
      </p>
    </div>
  )
}
