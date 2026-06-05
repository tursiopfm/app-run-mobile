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
import { SplashVisual } from '@/components/ui/SplashVisual'

// useLayoutEffect côté client (retire le splash avant peinture), useEffect en SSR
// pour éviter le warning React.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type Phase = 'show' | 'fade' | 'done'

const SHOW_MS = 2600 // durée pleine de notre splash (après que la page soit visible)
const FADE_MS = 600 // durée du fondu de sortie

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

    let toFade: ReturnType<typeof setTimeout>
    let toDone: ReturnType<typeof setTimeout>
    let onVis: (() => void) | null = null

    // Démarre le compte à rebours UNIQUEMENT quand la page est réellement à
    // l'écran (le splash OS peut masquer la page 2-3 s pendant le chargement ;
    // sans ça notre minuteur s'écoule derrière lui et le splash ne « flashe »
    // qu'une fraction de seconde).
    const begin = () => {
      toFade = setTimeout(() => setPhase('fade'), SHOW_MS)
      toDone = setTimeout(() => setPhase('done'), SHOW_MS + FADE_MS)
    }
    const kick = () => requestAnimationFrame(() => requestAnimationFrame(begin))

    if (document.visibilityState === 'visible') {
      kick()
    } else {
      onVis = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', onVis!)
          onVis = null
          kick()
        }
      }
      document.addEventListener('visibilitychange', onVis)
    }

    return () => {
      clearTimeout(toFade)
      clearTimeout(toDone)
      if (onVis) document.removeEventListener('visibilitychange', onVis)
    }
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
      <SplashVisual />
    </div>
  )
}
