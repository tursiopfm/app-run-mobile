'use client'

// Modal d'édition des phases d'un plan d'entraînement.
// Pattern portal cohérent avec RaceEditorModal (overlay click + escape + bottom sheet mobile).
// DnD intra-liste via dnd-kit (pattern simplifié vs BlockGrid : pas de dragHandle séparé).
// Persistance via saveCurrentPlan() de lib/plan/storage.

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Phase, PhaseType, Race, TrainingPlan } from '@/types/plan'
import { PHASE_DEFINITIONS, autoDistributePhases } from '@/lib/training/phases'
import { saveCurrentPlan } from '@/lib/plan/storage'

type Props = {
  plan: TrainingPlan | null
  race: Race | null
  open: boolean
  onClose: () => void
  onSaved: () => void
  focusPhaseId?: string
}

const PHASE_TYPE_OPTIONS: { value: PhaseType; label: string }[] = [
  { value: 'foncier',       label: 'Foncier'       },
  { value: 'developpement', label: 'Développement' },
  { value: 'specifique',    label: 'Spécifique'    },
  { value: 'affutage',      label: 'Affûtage'      },
  { value: 'recuperation',  label: 'Récupération'  },
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(iso: string, days: number): string {
  const t = new Date(iso + 'T00:00:00Z').getTime() + days * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `phase-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function newEmptyPhase(startDate: string, endDate: string): Phase {
  const def = PHASE_DEFINITIONS.foncier
  return {
    id: makeId(),
    type: 'foncier',
    label: `Phase ${def.label}`,
    startDate,
    endDate,
    weeklyChargeTarget: 300,
    description: def.description,
  }
}

export function PhaseEditorModal({ plan, race, open, onClose, onSaved, focusPhaseId }: Props) {
  const [phases, setPhases] = useState<Phase[]>(plan?.phases ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-sync à l'ouverture (le plan peut changer entre 2 ouvertures).
  useEffect(() => {
    if (open) {
      setPhases(plan?.phases ?? [])
      setError(null)
    }
  }, [open, plan])

  // Échap ferme.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Scroll vers la phase ciblée à l'ouverture.
  useEffect(() => {
    if (!open || !focusPhaseId) return
    const el = document.getElementById(`phase-row-${focusPhaseId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [open, focusPhaseId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const validationError = useMemo<string | null>(() => {
    for (const p of phases) {
      if (!p.label.trim()) return 'Chaque phase doit avoir un nom.'
      if (!p.startDate || !p.endDate) return 'Toutes les dates doivent être renseignées.'
      if (p.startDate >= p.endDate) return `La phase « ${p.label || p.type} » a des dates inversées.`
    }
    return null
  }, [phases])

  if (!open) return null
  if (typeof document === 'undefined') return null

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setPhases(prev => {
      const oldIdx = prev.findIndex(p => p.id === active.id)
      const newIdx = prev.findIndex(p => p.id === over.id)
      if (oldIdx < 0 || newIdx < 0) return prev
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  function handleAutoGenerate() {
    const start = todayISO()
    const raceDate = race?.date
    if (!raceDate) {
      setError("Définis d'abord ta course objectif pour auto-générer.")
      return
    }
    const next = autoDistributePhases(start, raceDate)
    if (next.length === 0) {
      setError("Impossible d'auto-générer : vérifie les dates de ta course.")
      return
    }
    setPhases(next)
    setError(null)
  }

  function handleAddPhase() {
    setPhases(prev => {
      const last = prev[prev.length - 1]
      const start = last ? last.endDate : (race?.date ? addDaysISO(race.date, -7) : todayISO())
      const end = addDaysISO(start, 7)
      return [...prev, newEmptyPhase(start, end)]
    })
  }

  function handlePhaseChange(id: string, patch: Partial<Phase>) {
    setPhases(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }

  function handlePhaseTypeChange(id: string, type: PhaseType) {
    const def = PHASE_DEFINITIONS[type]
    setPhases(prev => prev.map(p => (
      p.id === id
        ? { ...p, type, label: p.label.startsWith('Phase ') ? `Phase ${def.label}` : p.label }
        : p
    )))
  }

  function handleDeletePhase(id: string) {
    setPhases(prev => prev.filter(p => p.id !== id))
  }

  async function handleSave() {
    if (saving) return
    if (validationError) {
      setError(validationError)
      return
    }
    if (phases.length === 0) {
      setError('Ajoute au moins une phase ou auto-génère depuis ta course.')
      return
    }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const sortedPhases = [...phases]
      const startDate = sortedPhases.reduce((acc, p) => (p.startDate < acc ? p.startDate : acc), sortedPhases[0].startDate)
      const endDate = sortedPhases.reduce((acc, p) => (p.endDate > acc ? p.endDate : acc), sortedPhases[0].endDate)

      const updated: TrainingPlan = plan
        ? { ...plan, phases: sortedPhases, startDate, endDate, updatedAt: now }
        : {
            id: makeId(),
            athleteId: '',
            name: race ? `Prépa ${race.name}` : 'Prépa',
            goalRaceId: race?.id ?? null,
            startDate,
            endDate,
            phases: sortedPhases,
            createdAt: now,
            updatedAt: now,
          }
      await saveCurrentPlan(updated)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Éditer les phases du plan"
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold text-trail-text">Éditer les phases</h2>
          <button
            type="button"
            onClick={handleAutoGenerate}
            disabled={saving || !race}
            className="px-3 py-2 text-[13px] font-semibold text-trail-primary hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            aria-label="Auto-générer les phases depuis ma course"
            title={!race ? "Définis d'abord ta course objectif" : 'Régénère les phases depuis aujourd\'hui jusqu\'à la course'}
          >
            🪄 Auto-générer
          </button>
        </div>

        {error && (
          <div
            className="mb-3 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-danger text-trail-danger text-[13px]"
            role="alert"
          >
            {error}
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={phases.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {phases.length === 0 && (
                <div className="text-center text-trail-muted text-[13px] py-6">
                  Aucune phase. Ajoute-en une ou auto-génère depuis ta course.
                </div>
              )}
              {phases.map((p) => (
                <SortablePhaseRow
                  key={p.id}
                  phase={p}
                  highlight={p.id === focusPhaseId}
                  onChange={(patch) => handlePhaseChange(p.id, patch)}
                  onTypeChange={(t) => handlePhaseTypeChange(p.id, t)}
                  onDelete={() => handleDeletePhase(p.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={handleAddPhase}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-dashed border-trail-border text-trail-muted hover:border-trail-primary hover:text-trail-primary transition-colors text-[14px] font-semibold"
        >
          <span className="text-[18px] leading-none">+</span>
          <span>Ajouter une phase</span>
        </button>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-[10px] text-[14px] font-semibold text-trail-muted hover:text-trail-text disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || phases.length === 0 || validationError !== null}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-[14px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SortablePhaseRow({
  phase, highlight, onChange, onTypeChange, onDelete,
}: {
  phase: Phase
  highlight?: boolean
  onChange: (patch: Partial<Phase>) => void
  onTypeChange: (type: PhaseType) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: phase.id })
  const def = PHASE_DEFINITIONS[phase.type]

  return (
    <div
      id={`phase-row-${phase.id}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={`rounded-[10px] bg-trail-surface border p-3 ${highlight ? 'border-trail-primary' : 'border-trail-border'}`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Réordonner la phase ${phase.label}`}
          className="cursor-grab active:cursor-grabbing select-none px-1 py-2 flex-shrink-0"
          style={{ touchAction: 'none' }}
        >
          <div className="w-[5px] h-8 rounded-full bg-trail-muted hover:bg-trail-text transition-colors" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: def.color }}
                aria-hidden
              />
              <span className="text-[12px] font-semibold text-trail-muted truncate">{def.label}</span>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="text-[12px] font-semibold text-trail-danger hover:underline flex-shrink-0"
              aria-label={`Supprimer la phase ${phase.label}`}
            >
              Supprimer
            </button>
          </div>

          <div className="space-y-2">
            <Field label="Label" required>
              <input
                type="text"
                value={phase.label}
                onChange={(e) => onChange({ label: e.target.value })}
                className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <select
                  value={phase.type}
                  onChange={(e) => onTypeChange(e.target.value as PhaseType)}
                  className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
                >
                  {PHASE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Charge cible">
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={Number.isFinite(phase.weeklyChargeTarget) ? phase.weeklyChargeTarget : 0}
                    onChange={(e) => onChange({ weeklyChargeTarget: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 pr-[60px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-trail-muted pointer-events-none">
                    TSS/sem
                  </span>
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Début" required>
                <input
                  type="date"
                  value={phase.startDate}
                  onChange={(e) => onChange({ startDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
                />
              </Field>
              <Field label="Fin" required>
                <input
                  type="date"
                  value={phase.endDate}
                  onChange={(e) => onChange({ endDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                rows={2}
                value={phase.description ?? ''}
                onChange={(e) => onChange({ description: e.target.value })}
                className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary resize-none"
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, required, children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-trail-muted mb-1 block">
        {label}
        {required && <span className="text-trail-danger ml-1">*</span>}
      </span>
      {children}
    </label>
  )
}
