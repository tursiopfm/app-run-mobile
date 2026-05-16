'use client'

// Modal d'édition / création d'une séance planifiée (PlannedSession).
// Pattern portal cohérent avec RaceEditorModal / PhaseEditorModal (Échap ferme).
// 3 tabs : Général, Structure (zones), Notes.

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
import type {
  IntensityLevel,
  PlannedSession,
  SessionType,
  TrainingZone,
  ZoneKind,
} from '@/types/plan'
import {
  deletePlannedSession,
  getCurrentPlan,
  savePlannedSession,
} from '@/lib/plan/storage'
import { estimateCharge } from '@/lib/training/charge'
import {
  INTENSITY_LEVEL_COLORS,
  INTENSITY_LEVEL_LABELS,
  SESSION_TYPE_LABELS,
} from '@/lib/activities/indicators'
import TypeIndicator from '@/components/activity/TypeIndicator'

type Tab = 'general' | 'structure' | 'notes'

type Props = {
  session: PlannedSession | null
  initialDate?: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const TYPE_OPTIONS: SessionType[] = [
  'sortie_longue', 'fractionne', 'seuil_tempo', 'cotes', 'course', 'runtaf', 'velotaf', 'footing',
]

const ZONE_PRESETS: Record<ZoneKind, Omit<TrainingZone, 'id'>> = {
  warmup:   { kind: 'warmup',   durationMin: 15, intensity: 2, label: 'Échauffement' },
  main:     { kind: 'main',     durationMin: 30, intensity: 4, label: 'Bloc principal' },
  rest:     { kind: 'rest',     durationMin: 5,  intensity: 1, label: 'Récup' },
  cooldown: { kind: 'cooldown', durationMin: 10, intensity: 1, label: 'Retour calme' },
}

const ZONE_KIND_LABEL: Record<ZoneKind, string> = {
  warmup:   'Échauffement',
  main:     'Bloc principal',
  rest:     'Récup',
  cooldown: 'Retour calme',
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function todayISO(): string {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

function emptyDraft(initialDate: string | undefined): PlannedSession {
  return {
    id: '',
    planId: '',
    date: initialDate ?? todayISO(),
    type: 'sortie_longue',
    title: '',
    duration: 60,
    distance: undefined,
    elevation: undefined,
    intensity: 2,
    estimatedCharge: 0,
    zones: undefined,
    notes: undefined,
    status: 'planned',
  }
}

export function SessionEditorModal({
  session, initialDate, open, onClose, onSaved,
}: Props) {
  const isEdit = session !== null
  const [draft, setDraft] = useState<PlannedSession>(() => session ?? emptyDraft(initialDate))
  const [tab, setTab] = useState<Tab>('general')
  const [saving, setSaving] = useState(false)
  const [chargeOverridden, setChargeOverridden] = useState(false)

  useEffect(() => {
    if (open) {
      const base = session ?? emptyDraft(initialDate)
      setDraft(base)
      setTab('general')
      setChargeOverridden(isEdit) // En édition, on respecte la valeur stockée tant qu'on ne change rien.
    }
  }, [open, session, initialDate, isEdit])

  // Échap ferme.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Auto-recalcul de la charge tant que l'utilisateur ne l'a pas overridée.
  useEffect(() => {
    if (chargeOverridden) return
    const next = estimateCharge(draft.duration, draft.intensity, draft.elevation)
    setDraft(d => (d.estimatedCharge === next ? d : { ...d, estimatedCharge: next }))
  }, [draft.duration, draft.intensity, draft.elevation, chargeOverridden])

  const canSave = draft.title.trim().length > 0 && draft.duration > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    if (saving) return
    setSaving(true)
    try {
      let planId = draft.planId
      if (!planId) {
        const plan = await getCurrentPlan()
        planId = plan?.id ?? ''
      }
      const toSave: PlannedSession = {
        ...draft,
        id: draft.id || makeId(),
        planId,
        title: draft.title.trim(),
        notes: draft.notes?.trim() || undefined,
      }
      await savePlannedSession(toSave)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEdit || saving) return
    setSaving(true)
    try {
      await deletePlannedSession(draft.id)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicate() {
    if (saving) return
    setSaving(true)
    try {
      const copy: PlannedSession = {
        ...draft,
        id: makeId(),
        title: draft.title.trim() || 'Séance',
        status: 'planned',
        linkedActivityId: undefined,
      }
      await savePlannedSession(copy)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Éditer la séance' : 'Créer une séance'}
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold text-trail-text">
            {isEdit ? 'Modifier la séance' : 'Créer une séance'}
          </h2>
        </div>

        {/* Tabs */}
        <div
          className="flex items-stretch rounded-[10px] bg-trail-surface border border-trail-border overflow-hidden mb-4"
          role="tablist"
          aria-label="Sections de la séance"
        >
          <TabButton active={tab === 'general'}   onClick={() => setTab('general')}   label="Général" />
          <TabButton active={tab === 'structure'} onClick={() => setTab('structure')} label="Structure" />
          <TabButton active={tab === 'notes'}     onClick={() => setTab('notes')}     label="Notes" />
        </div>

        {tab === 'general' && (
          <GeneralTab
            draft={draft}
            setDraft={setDraft}
            onChargeEdit={() => setChargeOverridden(true)}
          />
        )}
        {tab === 'structure' && (
          <StructureTab draft={draft} setDraft={setDraft} />
        )}
        {tab === 'notes' && (
          <NotesTab draft={draft} setDraft={setDraft} />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-6 flex-wrap">
          <div className="flex items-center gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={saving}
                className="px-3 py-2 text-[13px] font-semibold text-trail-muted hover:text-trail-text disabled:opacity-50"
                aria-label="Dupliquer la séance"
              >
                Dupliquer
              </button>
            )}
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-2 text-[13px] font-semibold text-trail-danger hover:underline disabled:opacity-50"
                aria-label="Supprimer la séance"
              >
                Supprimer
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
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
              disabled={!canSave}
              className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-[14px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Tabs ───────────────────────────────────────────────────────────────────
function TabButton({
  active, onClick, label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-[13px] font-semibold transition-colors ${
        active
          ? 'bg-trail-primary text-white'
          : 'text-trail-muted hover:text-trail-text hover:bg-trail-border/30'
      }`}
    >
      {label}
    </button>
  )
}

function GeneralTab({
  draft, setDraft, onChargeEdit,
}: {
  draft: PlannedSession
  setDraft: React.Dispatch<React.SetStateAction<PlannedSession>>
  onChargeEdit: () => void
}) {
  const intensityColor = INTENSITY_LEVEL_COLORS[draft.intensity]
  return (
    <div className="space-y-3">
      <Field label="Titre" required>
        <input
          type="text"
          value={draft.title}
          onChange={e => setDraft({ ...draft, title: e.target.value })}
          placeholder="Ex : SL 2h vallonnée"
          className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
        />
      </Field>

      <Field label="Type">
        <div className="flex items-center gap-2">
          <select
            value={draft.type}
            onChange={e => setDraft({ ...draft, type: e.target.value as SessionType })}
            className="flex-1 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
          >
            {TYPE_OPTIONS.map(t => (
              <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <div style={{ width: 140 }}>
            <TypeIndicator type={draft.type} />
          </div>
        </div>
      </Field>

      <Field label="Date" required>
        <input
          type="date"
          value={draft.date}
          onChange={e => setDraft({ ...draft, date: e.target.value })}
          className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Durée (min)" required>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={Number.isFinite(draft.duration) ? draft.duration : 0}
            onChange={e => setDraft({ ...draft, duration: Number(e.target.value) || 0 })}
            className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
          />
        </Field>
        <Field label="Distance (km)">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            value={draft.distance ?? ''}
            onChange={e => setDraft({ ...draft, distance: e.target.value === '' ? undefined : Number(e.target.value) || 0 })}
            className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
          />
        </Field>
        <Field label="D+ (m)">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={draft.elevation ?? ''}
            onChange={e => setDraft({ ...draft, elevation: e.target.value === '' ? undefined : Number(e.target.value) || 0 })}
            className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
          />
        </Field>
      </div>

      <Field label={`Intensité — ${INTENSITY_LEVEL_LABELS[draft.intensity]}`}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={draft.intensity}
            onChange={e => setDraft({ ...draft, intensity: Number(e.target.value) as IntensityLevel })}
            className="flex-1"
            style={{ accentColor: intensityColor }}
            aria-label={`Intensité ${draft.intensity} sur 5 (${INTENSITY_LEVEL_LABELS[draft.intensity]})`}
          />
          <span
            className="px-2 py-1 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: `${intensityColor}26`, color: intensityColor }}
          >
            I{draft.intensity}
          </span>
        </div>
      </Field>

      <Field label="Charge estimée (TSS)">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={Number.isFinite(draft.estimatedCharge) ? draft.estimatedCharge : 0}
          onChange={e => {
            onChargeEdit()
            setDraft({ ...draft, estimatedCharge: Number(e.target.value) || 0 })
          }}
          className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
        />
      </Field>
    </div>
  )
}

function StructureTab({
  draft, setDraft,
}: {
  draft: PlannedSession
  setDraft: React.Dispatch<React.SetStateAction<PlannedSession>>
}) {
  const zones = draft.zones ?? []
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function setZones(next: TrainingZone[]) {
    setDraft({ ...draft, zones: next.length > 0 ? next : undefined })
  }

  function addZone(kind: ZoneKind) {
    const preset = ZONE_PRESETS[kind]
    setZones([...zones, { id: makeId(), ...preset }])
  }

  function updateZone(id: string, patch: Partial<TrainingZone>) {
    setZones(zones.map(z => (z.id === id ? { ...z, ...patch } : z)))
  }

  function removeZone(id: string) {
    setZones(zones.filter(z => z.id !== id))
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = zones.findIndex(z => z.id === active.id)
    const newIdx = zones.findIndex(z => z.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    setZones(arrayMove(zones, oldIdx, newIdx))
  }

  return (
    <div className="space-y-3">
      {/* Boutons rapides */}
      <div className="flex flex-wrap gap-2">
        {(['warmup', 'main', 'rest', 'cooldown'] as ZoneKind[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => addZone(k)}
            className="px-3 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
          >
            + {ZONE_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {/* Aperçu barre composite */}
      {zones.length > 0 && <ZonePreviewBar zones={zones} />}

      {/* Liste sortable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={zones.map(z => z.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {zones.map(z => (
              <SortableZoneRow
                key={z.id}
                zone={z}
                onChange={patch => updateZone(z.id, patch)}
                onDelete={() => removeZone(z.id)}
              />
            ))}
            {zones.length === 0 && (
              <div className="text-center text-trail-muted text-[12px] py-4">
                Ajoute des zones pour structurer la séance.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableZoneRow({
  zone, onChange, onDelete,
}: {
  zone: TrainingZone
  onChange: (patch: Partial<TrainingZone>) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: zone.id })
  const color = INTENSITY_LEVEL_COLORS[zone.intensity]

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="rounded-[10px] bg-trail-surface border border-trail-border p-2"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Réordonner la zone ${ZONE_KIND_LABEL[zone.kind]}`}
          className="cursor-grab active:cursor-grabbing select-none px-1 py-2 flex-shrink-0"
          style={{ touchAction: 'none' }}
        >
          <div className="w-[4px] h-7 rounded-full bg-trail-muted hover:bg-trail-text transition-colors" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="text-[11px] font-semibold text-trail-muted">{ZONE_KIND_LABEL[zone.kind]}</span>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="text-[11px] font-semibold text-trail-danger hover:underline"
              aria-label="Supprimer la zone"
            >
              Suppr.
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Durée (min)">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={Number.isFinite(zone.durationMin) ? zone.durationMin : 0}
                onChange={e => onChange({ durationMin: Number(e.target.value) || 0 })}
                className="w-full px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] focus:outline-none focus:border-trail-primary"
              />
            </Field>
            <Field label="Intensité">
              <select
                value={zone.intensity}
                onChange={e => onChange({ intensity: Number(e.target.value) as IntensityLevel })}
                className="w-full px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] focus:outline-none focus:border-trail-primary"
              >
                {[1, 2, 3, 4, 5].map(i => (
                  <option key={i} value={i}>I{i} — {INTENSITY_LEVEL_LABELS[i as IntensityLevel]}</option>
                ))}
              </select>
            </Field>
            {zone.kind === 'main' && (
              <Field label="Répétitions">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={zone.repeats ?? 1}
                  onChange={e => onChange({ repeats: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] focus:outline-none focus:border-trail-primary"
                />
              </Field>
            )}
          </div>

          <div className="mt-2">
            <Field label="Label">
              <input
                type="text"
                value={zone.label ?? ''}
                onChange={e => onChange({ label: e.target.value })}
                placeholder="Ex : 500m allure VMA"
                className="w-full px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] focus:outline-none focus:border-trail-primary"
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}

function ZonePreviewBar({ zones }: { zones: TrainingZone[] }) {
  const totalSec = zones.reduce(
    (acc, z) => acc + (z.durationMin || 0) * (z.repeats ?? 1),
    0,
  )
  if (totalSec <= 0) return null

  return (
    <div className="rounded-[8px] bg-trail-surface border border-trail-border p-2">
      <div className="text-[10px] font-semibold text-trail-muted mb-1 uppercase tracking-wider">
        Aperçu intensité
      </div>
      <svg width="100%" height="30" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
        {(() => {
          let x = 0
          return zones.map(z => {
            const w = ((z.durationMin || 0) * (z.repeats ?? 1) / totalSec) * 100
            const rect = (
              <rect
                key={z.id}
                x={x}
                y={0}
                width={w}
                height={30}
                fill={INTENSITY_LEVEL_COLORS[z.intensity]}
                opacity={0.85}
              />
            )
            x += w
            return rect
          })
        })()}
      </svg>
    </div>
  )
}

function NotesTab({
  draft, setDraft,
}: {
  draft: PlannedSession
  setDraft: React.Dispatch<React.SetStateAction<PlannedSession>>
}) {
  return (
    <Field label="Notes">
      <textarea
        rows={8}
        value={draft.notes ?? ''}
        onChange={e => setDraft({ ...draft, notes: e.target.value })}
        placeholder="Consignes, stratégie, ressentis…"
        className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary resize-none"
      />
    </Field>
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
