'use client'

// Modal d'édition des cycles d'un plan d'entraînement.
// Pattern portal cohérent avec RaceEditorModal (overlay click + escape + bottom sheet mobile).
// DnD intra-liste via dnd-kit. Accordéon : header coloré toujours visible, body
// collapsible (édition détaillée + tableau hebdo km/D+ pour chaque semaine).
// Persistance via saveCurrentPlan() de lib/plan/storage (JSONB weekly_targets).

import { Fragment, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Phase, PhaseType, PhaseWeeklyTarget, Race, TrainingPlan } from '@/types/plan'
import {
  PHASE_DEFINITIONS,
  autoDistributePhases,
  getPhaseWeeks,
  phaseWeekCount,
} from '@/lib/training/phases'
import { useOverlapGuard } from './useOverlapGuard'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

type Props = {
  plan: TrainingPlan | null
  race: Race | null
  open: boolean
  onClose: () => void
  onSaved: () => void
  focusPhaseId?: string
}

function buildPhaseTypeOptions(L: Dict['plan']): { value: PhaseType; label: string }[] {
  return [
    { value: 'foncier',       label: L.phaseTypes.foncier       },
    { value: 'developpement', label: L.phaseTypes.developpement },
    { value: 'specifique',    label: L.phaseTypes.specifique    },
    { value: 'affutage',      label: L.phaseTypes.affutage      },
    { value: 'recuperation',  label: L.phaseTypes.recuperation  },
  ]
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(iso: string, days: number): string {
  const t = new Date(iso + 'T00:00:00Z').getTime() + days * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

function formatDDMM(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `phase-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function newEmptyPhase(startDate: string, endDate: string, cycleLabelFn: (s: string) => string): Phase {
  const def = PHASE_DEFINITIONS.foncier
  return {
    id: makeId(),
    type: 'foncier',
    label: cycleLabelFn(def.label),
    startDate,
    endDate,
    weeklyChargeTarget: 300,
    weeklyDistanceKmTarget: 50,
    weeklyElevationMTarget: 800,
    description: def.description,
  }
}

export function PhaseEditorModal({ plan, race, open, onClose, onSaved, focusPhaseId }: Props) {
  const L = useT().plan
  const PHASE_TYPE_OPTIONS = useMemo(() => buildPhaseTypeOptions(L), [L])
  const [phases, setPhases] = useState<Phase[]>(plan?.phases ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Accordéon : ids des cycles dépliés. Multi-ouvert autorisé. À l'ouverture
  // du modal on déplie le cycle ciblé (focusPhaseId) ou le premier.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      const next = plan?.phases ?? []
      setPhases(next)
      setError(null)
      const initialOpen = new Set<string>()
      if (focusPhaseId && next.some(p => p.id === focusPhaseId)) {
        initialOpen.add(focusPhaseId)
      } else if (next.length > 0) {
        initialOpen.add(next[0].id)
      }
      setOpenIds(initialOpen)
    }
  }, [open, plan, focusPhaseId])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
      if (!p.label.trim()) return L.phaseEditorErrNameRequired
      if (!p.startDate || !p.endDate) return L.phaseEditorErrDateRequired
      if (p.startDate >= p.endDate) return L.phaseEditorErrDateOrder(p.label || p.type)
    }
    return null
  }, [phases, L])

  const { guardedSave, dialog } = useOverlapGuard()

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
      setError(L.phaseEditorErrNoRace)
      return
    }
    const next = autoDistributePhases(start, raceDate)
    if (next.length === 0) {
      setError(L.phaseEditorErrAutoFailed)
      return
    }
    setPhases(next)
    setOpenIds(new Set(next.length > 0 ? [next[0].id] : []))
    setError(null)
  }

  function handleAddPhase() {
    setPhases(prev => {
      const last = prev[prev.length - 1]
      const start = last ? last.endDate : (race?.date ? addDaysISO(race.date, -7) : todayISO())
      const end = addDaysISO(start, 7)
      const created = newEmptyPhase(start, end, L.phaseEditorCycleLabel)
      setOpenIds(o => {
        const next = new Set(o)
        next.add(created.id)
        return next
      })
      return [...prev, created]
    })
  }

  function handlePhaseChange(id: string, patch: Partial<Phase>) {
    setPhases(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }

  function handlePhaseTypeChange(id: string, type: PhaseType) {
    const def = PHASE_DEFINITIONS[type]
    setPhases(prev => prev.map(p => {
      if (p.id !== id) return p
      // Relabel auto seulement si l'utilisateur n'a pas customisé le nom.
      const autoLabel = p.label.startsWith('Cycle ') || p.label.startsWith('Phase ') || /\bcycle\b/i.test(p.label)
      return {
        ...p,
        type,
        label: autoLabel ? L.phaseEditorCycleLabel(L.phaseTypes[type]) : p.label,
        description: def.description,
      }
    }))
  }

  function handleDeletePhase(id: string) {
    setPhases(prev => prev.filter(p => p.id !== id))
    setOpenIds(o => {
      const next = new Set(o)
      next.delete(id)
      return next
    })
  }

  function toggleOpen(id: string) {
    setOpenIds(o => {
      const next = new Set(o)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleWeeklyTargetChange(
    phaseId: string,
    weekIdx: number,
    field: 'km' | 'dPlus',
    value: number,
  ) {
    setPhases(prev => prev.map(p => {
      if (p.id !== phaseId) return p
      const count = phaseWeekCount(p)
      // Matérialise un tableau de longueur = nombre de semaines, rempli depuis
      // les overrides existants ou les cibles uniformes.
      const next: PhaseWeeklyTarget[] = []
      for (let i = 0; i < count; i++) {
        const existing = p.weeklyTargets?.[i]
        next[i] = existing ?? {
          km: p.weeklyDistanceKmTarget,
          dPlus: p.weeklyElevationMTarget,
        }
      }
      if (weekIdx >= 0 && weekIdx < count) {
        next[weekIdx] = { ...next[weekIdx], [field]: value }
      }
      return { ...p, weeklyTargets: next }
    }))
  }

  async function handleSave() {
    if (saving) return
    if (validationError) {
      setError(validationError)
      return
    }
    if (phases.length === 0) {
      setError(L.phaseEditorErrAtLeastOne)
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
            name: race ? L.structurePlanName(race.name) : L.structureTitleBlock,
            goalRaceId: race?.id ?? null,
            startDate,
            endDate,
            phases: sortedPhases,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          }
      const saved = await guardedSave(updated)
      if (saved) {
        onSaved()
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (<>{createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={L.phaseEditorAriaDialog}
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[16px] font-semibold text-trail-text">{L.phaseEditorTitle}</h2>
          <button
            type="button"
            onClick={handleAutoGenerate}
            disabled={saving || !race}
            className="px-3 py-2 text-body-sm font-semibold text-trail-primary hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            aria-label={L.phaseEditorAutoGenAria}
            title={!race ? L.phaseEditorAutoGenTitleNoRace : L.phaseEditorAutoGenTitleOk}
          >
            {L.phaseEditorAutoGen}
          </button>
        </div>

        {error && (
          <div
            className="mb-3 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-danger text-trail-danger text-body-sm"
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
                <div className="text-center text-trail-muted text-body-sm py-6">
                  {L.phaseEditorEmptyList}
                </div>
              )}
              {phases.map((p) => (
                <SortablePhaseRow
                  key={p.id}
                  phase={p}
                  L={L}
                  phaseTypeOptions={PHASE_TYPE_OPTIONS}
                  isOpen={openIds.has(p.id)}
                  highlight={p.id === focusPhaseId}
                  onToggle={() => toggleOpen(p.id)}
                  onChange={(patch) => handlePhaseChange(p.id, patch)}
                  onTypeChange={(t) => handlePhaseTypeChange(p.id, t)}
                  onWeeklyChange={(weekIdx, field, value) =>
                    handleWeeklyTargetChange(p.id, weekIdx, field, value)
                  }
                  onDelete={() => handleDeletePhase(p.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={handleAddPhase}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-dashed border-trail-border text-trail-muted hover:border-trail-primary hover:text-trail-primary transition-colors text-body font-semibold"
        >
          <span className="text-h2 leading-none">+</span>
          <span>{L.phaseEditorAddPhase}</span>
        </button>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-[10px] text-body font-semibold text-trail-muted hover:text-trail-text disabled:opacity-50"
          >
            {L.phaseEditorCancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || phases.length === 0 || validationError !== null}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-body font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {L.phaseEditorSave}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )}{dialog}</>)
}

function SortablePhaseRow({
  phase, L, phaseTypeOptions, isOpen, highlight, onToggle, onChange, onTypeChange, onWeeklyChange, onDelete,
}: {
  phase: Phase
  L: Dict['plan']
  phaseTypeOptions: { value: PhaseType; label: string }[]
  isOpen: boolean
  highlight?: boolean
  onToggle: () => void
  onChange: (patch: Partial<Phase>) => void
  onTypeChange: (type: PhaseType) => void
  onWeeklyChange: (weekIdx: number, field: 'km' | 'dPlus', value: number) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: phase.id })
  const def = PHASE_DEFINITIONS[phase.type]
  const weekCount = phaseWeekCount(phase)
  const weeks = useMemo(() => getPhaseWeeks(phase), [phase])

  return (
    <div
      id={`phase-row-${phase.id}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        borderColor: highlight ? 'var(--trail-primary)' : def.color,
      }}
      className="rounded-[10px] border-2 overflow-hidden bg-trail-card"
    >
      {/* ─── Header (toujours visible, cliquable pour toggle) ────────────── */}
      <div
        className="flex items-center gap-2 px-2 py-2 select-none"
        style={{
          backgroundColor: `${def.color}1A`, // ~10% opacity tint
        }}
      >
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={L.phaseEditorReorderAria(phase.label)}
          className="cursor-grab active:cursor-grabbing select-none px-1 py-1.5 flex-shrink-0"
          style={{ touchAction: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-[5px] h-7 rounded-full bg-trail-muted hover:bg-trail-text transition-colors" />
        </button>

        {/* Pastille couleur + libellé + meta */}
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center gap-2 text-left py-1"
          aria-expanded={isOpen}
          aria-label={L.phaseEditorExpandAria(phase.label, isOpen)}
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: def.color }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="text-trail-text font-semibold text-body-sm truncate">
              {phase.label || L.phaseTypes[phase.type]}
            </div>
            <div className="text-micro text-trail-muted truncate">
              {weekCount} {L.phaseEditorWeeksShort} · {formatDDMM(phase.startDate)} → {formatDDMM(phase.endDate)}
            </div>
          </div>
        </button>

        {/* Supprimer */}
        <button
          type="button"
          onClick={onDelete}
          className="text-micro font-semibold text-trail-danger hover:underline px-2 py-1 flex-shrink-0"
          aria-label={L.phaseEditorDeleteAria(phase.label)}
        >
          {L.phaseEditorDelete}
        </button>

        {/* Chevron */}
        <button
          type="button"
          onClick={onToggle}
          className="flex-shrink-0 p-1 text-trail-muted hover:text-trail-text"
          aria-label={L.phaseEditorToggleAria(isOpen)}
        >
          <ChevronDown
            size={18}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
            }}
            aria-hidden
          />
        </button>
      </div>

      {/* ─── Body (collapsible) ─────────────────────────────────────────── */}
      {isOpen && (
        <div className="p-3 space-y-3 bg-trail-surface">
          <Field label={L.phaseEditorFieldName} required>
            <input
              type="text"
              value={phase.label}
              onChange={(e) => onChange({ label: e.target.value })}
              className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-body-sm focus:outline-none focus:border-trail-primary"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={L.phaseEditorFieldType}>
              <select
                value={phase.type}
                onChange={(e) => onTypeChange(e.target.value as PhaseType)}
                className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-body-sm focus:outline-none focus:border-trail-primary"
              >
                {phaseTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>

            <Field label={L.phaseEditorFieldFocus}>
              <input
                type="text"
                value={phase.focus ?? ''}
                onChange={(e) => onChange({ focus: e.target.value })}
                placeholder={L.phaseEditorFieldFocusPh}
                className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-body-sm focus:outline-none focus:border-trail-primary"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label={L.phaseEditorFieldStart} required>
              <input
                type="date"
                value={phase.startDate}
                onChange={(e) => onChange({ startDate: e.target.value })}
                className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-body-sm focus:outline-none focus:border-trail-primary"
              />
            </Field>
            <Field label={L.phaseEditorFieldEnd} required>
              <input
                type="date"
                value={phase.endDate}
                onChange={(e) => onChange({ endDate: e.target.value })}
                className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-body-sm focus:outline-none focus:border-trail-primary"
              />
            </Field>
          </div>

          {/* Objectifs semaine par semaine (km + D+) */}
          <div>
            <div className="text-micro font-semibold text-trail-muted mb-2">
              {L.phaseEditorWeeklyGoals}
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 items-center text-caption">
              <span className="text-[10px] uppercase tracking-wide text-trail-muted">{L.phaseEditorWeekCol}</span>
              <span className="text-[10px] uppercase tracking-wide text-trail-muted text-right">{L.phaseEditorVolumeCol}</span>
              <span className="text-[10px] uppercase tracking-wide text-trail-muted text-right">{L.phaseEditorDPlusCol}</span>
              {weeks.map((w, i) => (
                <Fragment key={`${phase.id}-w${i}`}>
                  <span className="text-trail-text">
                    {L.phaseEditorWeekN(i + 1)}
                    <span className="text-trail-muted"> · {formatDDMM(w.startISO)}</span>
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min={0}
                      value={Number.isFinite(w.km) ? w.km : 0}
                      onChange={(e) => onWeeklyChange(i, 'km', Number(e.target.value) || 0)}
                      className="w-[84px] pl-2 pr-[28px] py-1 rounded-[6px] bg-trail-card border border-trail-border text-trail-text text-right text-caption focus:outline-none focus:border-trail-primary"
                      aria-label={L.phaseEditorVolumeInputAria(i + 1, phase.label)}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-trail-muted pointer-events-none">km</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      step="10"
                      min={0}
                      value={Number.isFinite(w.dPlus) ? w.dPlus : 0}
                      onChange={(e) => onWeeklyChange(i, 'dPlus', Number(e.target.value) || 0)}
                      className="w-[84px] pl-2 pr-[24px] py-1 rounded-[6px] bg-trail-card border border-trail-border text-trail-text text-right text-caption focus:outline-none focus:border-trail-primary"
                      aria-label={L.phaseEditorDPlusInputAria(i + 1, phase.label)}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-trail-muted pointer-events-none">m</span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          <Field label={L.phaseEditorFieldDescription}>
            <textarea
              rows={2}
              value={phase.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-body-sm focus:outline-none focus:border-trail-primary resize-none"
            />
          </Field>
        </div>
      )}
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
      <span className="text-micro font-semibold text-trail-muted mb-1 block">
        {label}
        {required && <span className="text-trail-danger ml-1">*</span>}
      </span>
      {children}
    </label>
  )
}
