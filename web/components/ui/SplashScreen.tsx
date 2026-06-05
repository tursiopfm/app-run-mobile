'use client'

// Splash in-app affiché au lancement de la PWA (Android + iOS standalone) :
// fond Deep Mission + logo stacked + tagline, puis fondu vers l'app.
// Le splash OS (manifest bg + icône) n'affiche que l'icône ; ce composant
// apporte le concept complet « Préparer. Piloter. Accomplir. ».
//
// Gate : ne s'affiche qu'en mode standalone (app installée) OU avec ?splash=1
// (aperçu navigateur), une seule fois par session. En onglet navigateur normal,
// l'effet layout le retire avant la première peinture → aucun flash.

import { useEffect, useLayoutEffect, useState } from 'react'
import { LogoTrailCockpit } from '@/components/brand/LogoTrailCockpit'

// useLayoutEffect côté client (retire le splash avant peinture), useEffect en SSR
// pour éviter le warning React.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type Phase = 'show' | 'fade' | 'done'

export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('show')
  const [forced, setForced] = useState(false)

  useIsoLayoutEffect(() => {
    const isForced = new URLSearchParams(window.location.search).get('splash') === '1'
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    // ?splash=1 : aperçu qui reste affiché (preview navigateur, malgré le gate CSS).
    if (isForced) { setForced(true); return }
    if (!standalone || sessionStorage.getItem('tc_splash') === '1') {
      setPhase('done')
      return
    }
    sessionStorage.setItem('tc_splash', '1')
    const toFade = setTimeout(() => setPhase('fade'), 1100)
    const toDone = setTimeout(() => setPhase('done'), 1550)
    return () => { clearTimeout(toFade); clearTimeout(toDone) }
  }, [])

  if (phase === 'done') return null

  return (
    <div
      aria-hidden="true"
      className={`tc-splash${forced ? ' tc-splash--forced' : ''} fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 transition-opacity duration-500`}
      style={{
        background: '#0B0F14',
        opacity: phase === 'fade' ? 0 : 1,
        pointerEvents: phase === 'fade' ? 'none' : undefined,
      }}
    >
      <LogoTrailCockpit variant="stacked" tone="brand" size={88} />
      <p className="font-display text-[14px] tracking-[0.02em]" style={{ color: '#8BA8A3' }}>
        Préparer. Piloter. Accomplir.
      </p>
    </div>
  )
}
