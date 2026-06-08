'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  // destructive=true → bouton confirmer en rouge (action irréversible)
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  // Escape ferme la dialog.
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

  const confirmCls = destructive
    ? 'bg-trail-danger text-white hover:opacity-90'
    : 'bg-trail-primary text-black hover:opacity-90'

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] sm:rounded-[16px] w-full max-w-sm p-5 pb-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 sm:hidden" />
        <h2
          id="confirm-dialog-title"
          className="font-display text-[16px] font-semibold text-trail-text mb-2"
        >
          {title}
        </h2>
        <p className="text-body-sm text-trail-muted leading-[19px] whitespace-pre-line mb-5">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-body font-semibold text-trail-text hover:border-trail-primary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-[10px] text-body font-semibold ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
