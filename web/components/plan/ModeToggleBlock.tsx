'use client'

// Bloc Mode toggle (Manuel / IA Coach).
// Pas de persistance : on est toujours en "Manuel" (le coach IA arrive plus tard).
// Toast inline (pas de système de toast global dans le repo), snackbar fixed-bottom
// qui fade out après 2.5 s — évite l'`alert()` natif.

import { useState, useEffect } from 'react'

export function ModeToggleBlock() {
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(t)
  }, [toast])

  function handleClickIA() {
    setToast('Le coach IA arrive prochainement')
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div
        className="flex items-stretch rounded-[10px] bg-trail-surface border border-trail-border overflow-hidden"
        role="tablist"
        aria-label="Mode de planification"
      >
        {/* Segment actif : Manuel */}
        <button
          type="button"
          role="tab"
          aria-selected="true"
          aria-label="Mode Manuel (actif)"
          className="flex-1 px-3 py-2 bg-trail-primary text-white text-[13px] font-semibold cursor-default"
        >
          Manuel
        </button>

        {/* Segment IA Coach (désactivé) + mini-pill "Bientôt" */}
        <button
          type="button"
          role="tab"
          aria-selected="false"
          aria-label="Mode IA Coach (bientôt disponible)"
          onClick={handleClickIA}
          className="flex-1 px-3 py-2 text-trail-text/50 text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-trail-border/30 transition-colors"
        >
          <span>IA Coach</span>
          <span className="px-[6px] py-[2px] rounded-full text-[10px] font-semibold bg-trail-border/60 text-trail-muted leading-none">
            Bientôt
          </span>
        </button>
      </div>

      {/* Snackbar inline (créée localement faute de système global de toast) */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-3 rounded-[10px] bg-trail-card border border-trail-border shadow-2xl text-[13px] text-trail-text animate-[fadeIn_120ms_ease-out]"
          style={{ maxWidth: 'calc(100vw - 32px)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
