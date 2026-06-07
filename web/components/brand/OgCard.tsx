// web/components/brand/OgCard.tsx
// Concept Open Graph 1200×630 (preview). Rendu à taille réelle pour capture Playwright.
import { TrajectoryLine } from '@/components/brand/TrajectoryLine'

export function OgCard() {
  return (
    <div
      id="og-card"
      style={{ width: 1200, height: 630, position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(120% 120% at 78% 18%, #15202b 0%, #0B0F14 58%)' }}
    >
      <div style={{ position: 'absolute', right: 96, top: 150, width: 540, height: 250, overflow: 'visible', opacity: 0.95 }}>
        <TrajectoryLine orientation="horizontal" progress={0.62} />
      </div>
      <div style={{ position: 'absolute', inset: 0, padding: '64px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-512.png" width={40} height={40} alt="" style={{ borderRadius: 11 }} />
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            <span style={{ color: '#FF7900' }}>Trail</span> <span style={{ color: '#E2ECE9' }}>Cockpit</span>
          </span>
        </div>
        <div>
          <h2 className="font-display" style={{ fontSize: 74, lineHeight: 0.98, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: '#fff' }}>
            Trail Cockpit
          </h2>
          <p className="font-display" style={{ fontSize: 25, fontWeight: 600, color: '#FF7900', margin: '18px 0 0' }}>
            Préparer. Piloter. Accomplir.
          </p>
          <p className="font-body" style={{ fontSize: 20, color: '#8BA8A3', margin: '14px 0 0', maxWidth: 680, lineHeight: 1.45 }}>
            Le centre de contrôle intelligent des sportifs d&apos;endurance.
          </p>
        </div>
        <div className="font-body" style={{ fontSize: 15, color: '#5f7771', letterSpacing: '0.04em' }}>trailcockpit.run</div>
      </div>
    </div>
  )
}
