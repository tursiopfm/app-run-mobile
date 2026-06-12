'use client'

// Sélecteur heure/durée en deux champs numériques (HH : MM) — pas besoin de
// taper « : » (le clavier mobile est numérique). maxHours = 23 pour une heure
// d'horloge (départ), 99 pour une durée (objectif).
import { useEffect, useRef, useState } from 'react'

const clampNum = (raw: string, max: number) => {
  const n = parseInt(raw.replace(/\D/g, ''), 10)
  if (Number.isNaN(n)) return 0
  return Math.min(max, Math.max(0, n))
}

type Props = {
  open: boolean
  title: string
  hours: number
  minutes: number
  maxHours: number
  hint?: string
  onSave: (hours: number, minutes: number) => void
  onClose: () => void
}

export function TimeEditModal({ open, title, hours, minutes, maxHours, hint, onSave, onClose }: Props) {
  const [h, setH] = useState('')
  const [m, setM] = useState('')
  const hRef = useRef<HTMLInputElement>(null)
  const mRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setH(String(hours))
    setM(String(minutes).padStart(2, '0'))
    const t = setTimeout(() => hRef.current?.select(), 30)
    return () => clearTimeout(t)
  }, [open, hours, minutes])

  if (!open) return null

  const submit = () => {
    onSave(clampNum(h || '0', maxHours), clampNum(m || '0', 59))
    onClose()
  }

  const field = 'w-[64px] rounded-[10px] border border-trail-border bg-trail-surface py-2 text-center text-[28px] font-bold text-trail-text outline-none focus:border-trail-primary'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[300px] rounded-[14px] border border-[var(--ink-500)] bg-trail-card p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 font-display text-body font-semibold text-trail-text">{title}</h3>
        <div className="flex items-center justify-center gap-2 font-display">
          <input
            ref={hRef} type="text" inputMode="numeric" maxLength={2} aria-label="Heures" value={h}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '')
              setH(v)
              if (v.length === 2) mRef.current?.select()
            }}
            onFocus={(e) => e.currentTarget.select()}
            className={field}
          />
          <span className="text-[28px] font-bold text-trail-muted">:</span>
          <input
            ref={mRef} type="text" inputMode="numeric" maxLength={2} aria-label="Minutes" value={m}
            onChange={(e) => setM(e.target.value.replace(/\D/g, ''))}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            className={field}
          />
        </div>
        {hint && <p className="mt-3 text-center text-caption text-trail-muted">{hint}</p>}
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
