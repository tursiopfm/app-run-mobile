'use client'

// Fenêtre de choix de la taille d'impression de la carte (iPhone / A5 / A4).
// Persistance gérée par le parent. Même habillage que PrintColumnsDialog.
import { createPortal } from 'react-dom'
import { PRINT_SIZE_DEFS, type PrintSize } from '@/lib/plan/print-size'

type Props = {
  open: boolean
  value: PrintSize
  onChange: (next: PrintSize) => void
  onClose: () => void
}

const ORDER: PrintSize[] = ['iphone', 'a5', 'a4']

export function PrintSizeDialog({ open, value, onChange, onClose }: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Personnaliser la taille de la carte"
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-md max-h-[90vh] overflow-y-auto p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />
        <h2 className="font-display text-[16px] font-semibold text-trail-text mb-1">Taille de la carte</h2>
        <p className="text-caption text-trail-muted mb-4">{"Détermine le format d'impression du PDF (sans effet sur l'image / le partage)."}</p>

        <div className="space-y-2">
          {ORDER.map((k) => {
            const def = PRINT_SIZE_DEFS[k]
            const active = value === k
            return (
              <label
                key={k}
                className={`flex items-start gap-3 px-3 py-3 rounded-[10px] border cursor-pointer select-none ${active ? 'border-trail-primary' : 'border-trail-border'} bg-trail-surface`}
              >
                <input
                  type="radio"
                  name="print-size"
                  checked={active}
                  onChange={() => onChange(k)}
                  className="w-4 h-4 mt-0.5"
                />
                <span className="flex-1">
                  <span className="block text-body font-semibold text-trail-text">{def.label}</span>
                  <span className="block text-caption text-trail-muted">{def.hint}</span>
                </span>
              </label>
            )
          })}
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-body font-semibold"
          >
            Terminé
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
