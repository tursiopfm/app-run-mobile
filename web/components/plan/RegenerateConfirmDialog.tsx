'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  phaseLabel: string
  loadPattern: string
  weekCountWithOverride: number
  onConfirm: () => void
  onCancel: () => void
}

export function RegenerateConfirmDialog({
  open, phaseLabel, loadPattern, weekCountWithOverride, onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const plural = weekCountWithOverride > 1 ? 's' : ''

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmer la régénération forcée"
    >
      <div
        className="w-full sm:max-w-md bg-[color:var(--trail-card)] border border-[color:var(--trail-border)] rounded-t-[16px] sm:rounded-[16px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-bold text-[color:var(--trail-text)] mb-2">
          Forcer la régénération ?
        </h3>
        <p className="text-[12px] text-[color:var(--trail-muted)] leading-relaxed mb-4">
          {weekCountWithOverride} semaine{plural} modifiée{plural} manuellement {plural ? 'seront écrasées' : 'sera écrasée'} par les valeurs du pattern{' '}
          <span className="font-semibold text-[color:var(--trail-text)]">{loadPattern}</span> du cycle{' '}
          <span className="font-semibold text-[color:var(--trail-text)]">« {phaseLabel} »</span>. Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-[8px] bg-[color:var(--trail-surface)] text-[13px] text-[color:var(--trail-text)]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-[8px] bg-red-700 hover:bg-red-600 text-white text-[13px] font-bold"
          >
            Forcer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
