'use client'

// Petite fenêtre pop-up pour éditer UNE valeur (objectif ou heure de départ).
// Le parent fournit la validation (validate) et applique la valeur (onSave).
import { useEffect, useRef, useState } from 'react'

type Props = {
  open: boolean
  title: string
  initial: string
  placeholder?: string
  hint?: string
  validate: (raw: string) => boolean
  onSave: (raw: string) => void
  onClose: () => void
}

export function QuickEditModal({ open, title, initial, placeholder, hint, validate, onSave, onClose }: Props) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setValue(initial)
    setError(false)
    const t = setTimeout(() => inputRef.current?.select(), 30)
    return () => clearTimeout(t)
  }, [open, initial])

  if (!open) return null

  const submit = () => {
    const v = value.trim()
    if (!validate(v)) { setError(true); return }
    onSave(v)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[300px] rounded-[14px] border border-[var(--ink-500)] bg-trail-card p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 font-display text-body font-semibold text-trail-text">{title}</h3>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onChange={(e) => { setValue(e.target.value); setError(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') onClose() }}
          className="w-full rounded-[8px] border border-trail-border bg-trail-surface px-3 py-2 text-body text-trail-text outline-none focus:border-trail-primary"
        />
        {error
          ? <p className="mt-1.5 text-caption text-trail-danger">Valeur invalide.</p>
          : hint && <p className="mt-1.5 text-caption text-trail-muted">{hint}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-[8px] px-3 py-1.5 text-body-sm text-trail-muted hover:text-trail-text">
            Annuler
          </button>
          <button type="button" onClick={submit}
            className="rounded-[8px] bg-trail-primary px-4 py-1.5 text-body-sm font-semibold text-white">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
