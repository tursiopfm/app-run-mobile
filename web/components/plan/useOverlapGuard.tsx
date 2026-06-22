'use client'

// Garde anti-chevauchement : enveloppe l'enregistrement d'un macrocycle.
// Si le candidat chevauche un (des) cycle(s) actif(s), ouvre un dialogue
// « avertir + proposer » (archiver l'autre / confirmer quand même / ajuster).
// La logique de détection est pure (lib/plan/overlap) ; ce hook orchestre l'I/O + l'UI.

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { TrainingPlan } from '@/types/plan'
import { getAllMacrocycles, saveCurrentPlan } from '@/lib/plan/storage'
import { findActiveOverlaps } from '@/lib/plan/overlap'
import { useT } from '@/lib/i18n/I18nProvider'

function fmtDDMM(iso: string): string {
  return iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso
}

export function useOverlapGuard(): { guardedSave: (candidate: TrainingPlan) => Promise<boolean>; dialog: ReactNode } {
  const L = useT().plan
  const [conflicts, setConflicts] = useState<TrainingPlan[] | null>(null)
  const candidateRef = useRef<TrainingPlan | null>(null)
  const resolveRef = useRef<((saved: boolean) => void) | null>(null)

  const guardedSave = useCallback(async (candidate: TrainingPlan): Promise<boolean> => {
    const all = await getAllMacrocycles()
    const found = findActiveOverlaps(candidate, all)
    if (found.length === 0) {
      await saveCurrentPlan(candidate)
      return true
    }
    candidateRef.current = candidate
    setConflicts(found)
    return new Promise<boolean>((resolve) => { resolveRef.current = resolve })
  }, [])

  const settle = useCallback((saved: boolean) => {
    setConflicts(null)
    candidateRef.current = null
    const r = resolveRef.current
    resolveRef.current = null
    r?.(saved)
  }, [])

  const handleArchive = useCallback(async () => {
    const candidate = candidateRef.current
    const found = conflicts ?? []
    if (!candidate) return settle(false)
    for (const c of found) await saveCurrentPlan({ ...c, status: 'archived' })
    await saveCurrentPlan(candidate)
    settle(true)
  }, [conflicts, settle])

  const handleConfirm = useCallback(async () => {
    const candidate = candidateRef.current
    if (!candidate) return settle(false)
    await saveCurrentPlan(candidate)
    settle(true)
  }, [settle])

  const handleAdjust = useCallback(() => settle(false), [settle])

  const dialog = conflicts && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label={L.overlapTitle}
          onClick={handleAdjust}
        >
          <div
            className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-md p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />
            <h2 className="font-display text-[16px] font-semibold text-trail-text mb-2">{L.overlapTitle}</h2>
            <p className="text-body-sm text-[color:var(--trail-muted)] mb-3">{L.overlapBody}</p>
            <ul className="mb-4 space-y-1">
              {conflicts.map((c) => (
                <li key={c.id} className="text-caption text-trail-text">
                  • {L.overlapItem(c.name, fmtDDMM(c.startDate), fmtDDMM(c.endDate))}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleArchive}
                className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-body font-semibold"
              >
                {L.overlapArchive}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 rounded-[10px] bg-trail-card border border-trail-border text-trail-text text-body-sm font-semibold hover:border-trail-primary"
              >
                {L.overlapConfirm}
              </button>
              <button
                type="button"
                onClick={handleAdjust}
                className="px-4 py-2 rounded-[10px] text-[color:var(--trail-muted)] text-body-sm hover:text-trail-text"
              >
                {L.overlapAdjust}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return { guardedSave, dialog }
}
