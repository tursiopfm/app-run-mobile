'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

// Bottom-sheet unifié du Design System.
// Remplace progressivement les ~18 implémentations ad hoc de
// `fixed inset-0 bg-black/60` (BlockHelpSheet, FatigueHelpSheet, modales Plan…).

type SheetProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Largeur max du panneau (défaut max-w-lg). */
  maxWidthClassName?: string
  className?: string
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = 'max-w-lg',
  className,
}: SheetProps) {
  // Fermeture clavier + lock du scroll body tant que la sheet est ouverte.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full rounded-t-2xl bg-ink-700 border border-ink-600 border-b-0',
          'px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))]',
          'animate-[sheetUp_220ms_cubic-bezier(0.32,0.72,0,1)]',
          maxWidthClassName,
          className,
        )}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-500" />
        {title && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-[17px] font-semibold tracking-tight text-trail-text">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-trail-muted hover:bg-ink-600/60 hover:text-trail-text"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
