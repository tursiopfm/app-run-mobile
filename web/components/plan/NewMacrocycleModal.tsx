'use client'

// Modal de création d'un nouveau macrocycle (TrainingPlan).
// Pattern portal cohérent avec RaceEditorModal (createPortal + Escape + stopPropagation).
// Persistance via lib/plan/storage.ts (Supabase si dispo, fallback localStorage).

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Race, TrainingPlan } from '@/types/plan'
import { saveMacrocycle } from '@/lib/plan/storage'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (newMacroId: string) => void
  races: Race[]
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function addWeeksISO(iso: string, weeks: number): string {
  const t = new Date(iso + 'T00:00:00Z').getTime() + weeks * 7 * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `macro-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function NewMacrocycleModal({ open, onClose, onCreated, races }: Props) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(addWeeksISO(todayISO(), 12))
  const [goalRaceId, setGoalRaceId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form on open
  useEffect(() => {
    if (open) {
      setName('')
      setStartDate(todayISO())
      setEndDate(addWeeksISO(todayISO(), 12))
      setGoalRaceId('')
      setError(null)
    }
  }, [open])

  // Escape key handler
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const futureRaces = races
    .filter(r => r.date >= todayISO())
    .sort((a, b) => a.date.localeCompare(b.date))

  async function handleSave() {
    setError(null)
    if (endDate <= startDate) {
      setError('La date de fin doit être après la date de début.')
      return
    }
    setSaving(true)
    try {
      const today = todayISO()
      const status: TrainingPlan['status'] =
        startDate <= today && today <= endDate ? 'active' : 'planned'
      const now = new Date().toISOString()
      const finalName = name.trim() || `Macrocycle ${today}`
      const plan: TrainingPlan = {
        id: makeId(),
        athleteId: '',
        name: finalName,
        goalRaceId: goalRaceId || null,
        startDate,
        endDate,
        phases: [],
        status,
        createdAt: now,
        updatedAt: now,
      }
      await saveMacrocycle(plan)
      onCreated(plan.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(`Création échouée : ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Créer un macrocycle"
    >
      <div
        className="w-full sm:max-w-md bg-[color:var(--trail-card)] border border-[color:var(--trail-border)] rounded-t-[16px] sm:rounded-[16px] p-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-[20px] mb-3 text-[color:var(--trail-text)]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          Nouveau macrocycle
        </h3>

        <div className="space-y-3">
          <Field label="Nom">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prépa UTMB 2026"
              className="w-full px-3 py-2 rounded-[8px] bg-[color:var(--trail-surface)] border border-[color:var(--trail-border)] text-[14px] text-[color:var(--trail-text)] focus:outline-none focus:border-[color:var(--trail-primary)]"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Début">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-[8px] bg-[color:var(--trail-surface)] border border-[color:var(--trail-border)] text-[14px] text-[color:var(--trail-text)] focus:outline-none focus:border-[color:var(--trail-primary)]"
              />
            </Field>
            <Field label="Fin">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-[8px] bg-[color:var(--trail-surface)] border border-[color:var(--trail-border)] text-[14px] text-[color:var(--trail-text)] focus:outline-none focus:border-[color:var(--trail-primary)]"
              />
            </Field>
          </div>

          <Field label="Course objectif (optionnel)">
            <select
              value={goalRaceId}
              onChange={(e) => setGoalRaceId(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] bg-[color:var(--trail-surface)] border border-[color:var(--trail-border)] text-[14px] text-[color:var(--trail-text)] focus:outline-none focus:border-[color:var(--trail-primary)]"
            >
              <option value="">Aucune</option>
              {futureRaces.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.date}) — {r.priority}
                </option>
              ))}
            </select>
          </Field>

          {error && (
            <p className="text-[12px] text-red-400 px-1">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2 rounded-[8px] bg-[color:var(--trail-surface)] text-[13px] text-[color:var(--trail-text)] disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-[8px] bg-[color:var(--trail-primary)] text-white text-[13px] font-bold disabled:opacity-50"
          >
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--trail-muted)] block mb-1 px-1">
        {label}
      </span>
      {children}
    </label>
  )
}
