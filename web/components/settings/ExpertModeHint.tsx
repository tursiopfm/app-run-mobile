'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BarChart3 } from 'lucide-react'

// Pop-up affiché au passage en Mode Expert (déclenché par l'événement
// 'tc:show-expert-hint' émis par le bouton de bascule). Indique comment
// revenir au Mode Mission. Monté en permanence dans AppShell.
export function ExpertModeHint() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('tc:show-expert-hint', handler)
    return () => window.removeEventListener('tc:show-expert-hint', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[16px] bg-trail-card border border-trail-border p-5 text-center"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-trail-primary/15">
          <BarChart3 className="text-trail-primary" size={24} />
        </div>
        <h2 className="text-[17px] font-bold text-trail-text">Mode Expert activé</h2>
        <p className="mt-2 text-[13px] text-trail-muted leading-relaxed">
          Tu as maintenant accès au cockpit complet. Pour revenir au Mode Mission,
          va dans <span className="font-semibold text-trail-text">Réglages → Mode d’affichage</span>.
        </p>
        <button
          onClick={() => setOpen(false)}
          className="mt-4 w-full rounded-[10px] bg-trail-primary py-2.5 text-[14px] font-semibold text-white hover:bg-trail-primary-dim transition-colors"
        >
          Compris
        </button>
      </div>
    </div>,
    document.body,
  )
}
