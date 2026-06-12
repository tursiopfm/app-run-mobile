'use client'

// Overlay plein écran « page de détail » du Mode Mission, ouvert depuis un bloc
// du Cockpit (compteur de forme, km/D+ de la semaine). Réutilise des blocs Expert
// déjà alimentés côté client — pas de nouvelle route ni de fetch serveur.

import { useEffect } from 'react'

type Props = { title: string; onClose: () => void; children: React.ReactNode }

export function MissionDetailSheet({ title, onClose, children }: Props) {
  // Fige le scroll de fond + ferme sur Échap tant que l'overlay est ouvert.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-trail-bg">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-trail-border bg-trail-bg/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          aria-label="Retour"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[22px] leading-none text-trail-text hover:bg-trail-card"
        >
          ‹
        </button>
        <p className="font-display text-[17px] font-bold text-trail-text">{title}</p>
      </div>
      <div className="mx-auto max-w-lg space-y-3 px-3 py-3 pb-24">{children}</div>
    </div>
  )
}
