'use client'

// Modal d'édition / création d'un SessionTemplate custom.
// Variante de SessionEditorModal : pas de champ Date, mais champ Tags (chips).
// Persistance via saveCustomTemplate() / deleteCustomTemplate() de lib/plan/storage.

import { useEffect, useState } from 'react'
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
  IntensityMode,
  RepeatStep,
  RepeatZone,
  SessionTemplate,
  SessionType,
  SessionZone,
  TrainingZone,
  ZoneKind,
  ZoneMode,
} from '@/types/plan'
import { isRepeatZone } from '@/types/plan'
import { RepeatZoneCard } from '@/components/plan/RepeatZoneCard'
import {
  deleteCustomTemplate,
  saveCustomTemplate,
} from '@/lib/plan/storage'
import {
  INTENSITY_LEVEL_COLORS,
  INTENSITY_LEVEL_LABELS,
} from '@/lib/activities/indicators'
import { DurationDistanceToggle } from '@/components/plan/DurationDistanceToggle'
import { IntensityPaceToggle } from '@/components/plan/IntensityPaceToggle'
import { PaceField } from '@/components/plan/PaceField'
import { getDefaultIntensityMode } from '@/lib/plan/type-helpers'
import { DurationField } from '@/components/plan/DurationField'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import type { ActivityType } from '@/types/activity-types'

type Tab = 'general' | 'structure' | 'notes'

type Props = {
  template: SessionTemplate | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

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

function emptyDraft(): SessionTemplate {
  return {
    id: '',
    type: 'sortie_longue',
    title: '',
    defaultDuration: 60,
    defaultDistance: undefined,
    defaultElevation: undefined,
    defaultIntensity: 2,
    defaultZones: undefined,
    description: '',
    tags: undefined,
  }
}

export function TemplateEditorModal({ template, open, onClose, onSaved }: Props) {
  // isEdit = vrai uniquement pour un template custom existant (id non vide).
  // Un fork d'un template système arrive avec id='' → considéré comme création.
  const isEdit = template !== null && (template.id ?? '') !== ''
  const [draft, setDraft] = useState<SessionTemplate>(() => template ?? emptyDraft())
  const [tab, setTab] = useState<Tab>('general')
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const { visibleTypes, types } = useActivityTypes()

  useEffect(() => {
    if (open) {
      setDraft(template ?? emptyDraft())
      setTab('general')
      setTagInput('')
    }
  }, [open, template])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const canSave = draft.title.trim().length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    if (saving) return
    setSaving(true)
    try {
      const toSave: SessionTemplate = {
        ...draft,
        id: draft.id || makeId(),
        title: draft.title.trim(),
        description: (draft.description ?? '').trim(),
        tags: draft.tags && draft.tags.length > 0 ? draft.tags : undefined,
      }
      await saveCustomTemplate(toSave)
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
      await deleteCustomTemplate(draft.id)
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
      const copy: SessionTemplate = {
        ...draft,
        id: makeId(),
        title: (draft.title.trim() || 'Template') + ' (copie)',
      }
      await saveCustomTemplate(copy)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function addTag() {
    const t = tagInput.trim()
    if (!t) return
    const next = [...(draft.tags ?? [])]
    if (!next.includes(t)) next.push(t)
    setDraft({ ...draft, tags: next })
    setTagInput('')
  }

  function removeTag(t: string) {
    setDraft({ ...draft, tags: (draft.tags ?? []).filter(x => x !== t) })
  }

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Éditer le template' : 'Créer un template'}
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />

        <h2 className="text-[16px] font-semibold text-trail-text mb-3">
          {isEdit ? 'Modifier le template' : 'Nouveau template'}
        </h2>

        <div
          className="flex items-stretch rounded-[10px] bg-trail-surface border border-trail-border overflow-hidden mb-4"
          role="tablist"
          aria-label="Sections du template"
        >
          <TabButton active={tab === 'general'}   onClick={() => setTab('general')}   label="Général" />
          <TabButton active={tab === 'structure'} onClick={() => setTab('structure')} label="Structure" />
          <TabButton active={tab === 'notes'}     onClick={() => setTab('notes')}     label="Description" />
        </div>

        {tab === 'general' && (
          <GeneralTab
            draft={draft}
            setDraft={setDraft}
            tagInput={tagInput}
            setTagInput={setTagInput}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            visibleTypes={visibleTypes}
            types={types}
          />
        )}
        {tab === 'structure' && <StructureTab draft={draft} setDraft={setDraft} />}
        {tab === 'notes' && <NotesTab draft={draft} setDraft={setDraft} />}

        <div className="flex items-center justify-between gap-2 mt-6 flex-wrap">
          <div className="flex items-center gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={saving}
                className="px-3 py-2 text-[13px] font-semibold text-trail-muted hover:text-trail-text disabled:opacity-50"
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
  draft, setDraft, tagInput, setTagInput, onAddTag, onRemoveTag, visibleTypes, types,
}: {
  draft: SessionTemplate
  setDraft: React.Dispatch<React.SetStateAction<SessionTemplate>>
  tagInput: string
  setTagInput: (s: string) => void
  onAddTag: () => void
  onRemoveTag: (t: string) => void
  visibleTypes: ActivityType[]
  types: ActivityType[]
}) {
  const intensityColor = INTENSITY_LEVEL_COLORS[draft.defaultIntensity]
  return (
    <div className="space-y-3">
      <Field label="Titre" required>
        <input
          type="text"
          value={draft.title}
          onChange={e => setDraft({ ...draft, title: e.target.value })}
          placeholder="Ex : 10×400m VMA"
          className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
        />
      </Field>

      <Field label="Type">
        <div className="flex items-center gap-2">
          <select
            value={draft.type}
            onChange={e => {
              const nextType = e.target.value
              const nextMeta = resolveSessionMeta(nextType, types)
              setDraft({
                ...draft,
                type: nextType,
                defaultIntensity: nextMeta.defaultIntensity,
                defaultZones: draft.defaultZones?.map(z => {
                  if (!nextMeta.isRunning && !isRepeatZone(z) && z.intensityMode === 'pace') {
                    return { ...z, intensityMode: 'level' as const }
                  }
                  return z
                }),
              })
            }}
            className="flex-1 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
          >
            {(['run', 'bike', 'swim', 'other'] as const).map(cat => {
              const optionsInCat = visibleTypes.filter(t => (t.category ?? 'other') === cat)
              if (optionsInCat.length === 0) return null
              const labels = { run: 'Course à pied', bike: 'Vélo', swim: 'Natation', other: 'Autre' } as const
              return (
                <optgroup key={cat} label={labels[cat]}>
                  {optionsInCat.map(t => (
                    <option key={t.slug} value={t.slug}>{t.label}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          <TypeBadge type={draft.type} types={types} />
        </div>
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Durée">
          <DurationField
            value={draft.defaultDuration}
            onChange={(d) => setDraft({ ...draft, defaultDuration: d })}
          />
        </Field>
        <Field label="Distance (km)">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            value={draft.defaultDistance ?? ''}
            onChange={e => setDraft({ ...draft, defaultDistance: e.target.value === '' ? undefined : Number(e.target.value) || 0 })}
            className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
          />
        </Field>
        <Field label="D+ (m)">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={draft.defaultElevation ?? ''}
            onChange={e => setDraft({ ...draft, defaultElevation: e.target.value === '' ? undefined : Number(e.target.value) || 0 })}
            className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
          />
        </Field>
      </div>

      <Field label={`Intensité — ${INTENSITY_LEVEL_LABELS[draft.defaultIntensity]}`}>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={draft.defaultIntensity}
          onChange={e => setDraft({ ...draft, defaultIntensity: Number(e.target.value) as IntensityLevel })}
          className="w-full"
          style={{ accentColor: intensityColor }}
          aria-label={`Intensité ${draft.defaultIntensity} sur 5 (${INTENSITY_LEVEL_LABELS[draft.defaultIntensity]})`}
        />
      </Field>

      <Field label="Tags">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {(draft.tags ?? []).map(t => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-trail-surface border border-trail-border text-[11px] text-trail-text"
              >
                {t}
                <button
                  type="button"
                  onClick={() => onRemoveTag(t)}
                  className="text-trail-muted hover:text-trail-danger text-[12px] leading-none"
                  aria-label={`Retirer le tag ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAddTag()
                }
              }}
              placeholder="Ex : VMA, piste"
              className="flex-1 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
            />
            <button
              type="button"
              onClick={onAddTag}
              className="px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
            >
              Ajouter
            </button>
          </div>
        </div>
      </Field>
    </div>
  )
}

function makeDefaultRepeatZone(): RepeatZone {
  return {
    id: makeId(),
    kind: 'repeat',
    repeats: 4,
    skipLastRecovery: false,
    steps: [
      {
        id: makeId(),
        stepKind: 'effort',
        mode: 'distance',
        distanceM: 400,
        intensityMode: 'level',
        intensity: 5,
      },
      {
        id: makeId(),
        stepKind: 'recovery',
        mode: 'duration',
        durationMin: 1,
        intensityMode: 'level',
        intensity: 1,
      },
    ],
  }
}

function estimateDurationFromStep(step: RepeatStep): number {
  if (step.mode === 'distance' && step.distanceM && step.paceSecPerKm) {
    return Math.max(1, Math.round((step.distanceM / 1000) * step.paceSecPerKm / 60))
  }
  return 1
}

function flattenZonesForPreview(zones: SessionZone[]): TrainingZone[] {
  const out: TrainingZone[] = []
  for (const z of zones) {
    if (isRepeatZone(z)) {
      for (let i = 0; i < z.repeats; i++) {
        const skipLast = z.skipLastRecovery && i === z.repeats - 1
        for (const step of z.steps) {
          if (skipLast && step.stepKind === 'recovery') continue
          out.push({
            id: `${z.id}-${i}-${step.id}`,
            kind: step.stepKind === 'effort' ? 'main' : 'rest',
            mode: step.mode,
            durationMin: step.durationMin ?? estimateDurationFromStep(step),
            distanceM: step.distanceM,
            intensity: step.intensity ?? 3,
            intensityMode: step.intensityMode,
            paceSecPerKm: step.paceSecPerKm,
            label: step.label,
          })
        }
      }
    } else {
      out.push(z)
    }
  }
  return out
}

function StructureTab({
  draft, setDraft,
}: {
  draft: SessionTemplate
  setDraft: React.Dispatch<React.SetStateAction<SessionTemplate>>
}) {
  const zones = draft.defaultZones ?? []
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function setZones(next: SessionZone[]) {
    setDraft({ ...draft, defaultZones: next.length > 0 ? next : undefined })
  }

  function addZone(kind: ZoneKind) {
    const preset = ZONE_PRESETS[kind]
    setZones([...zones, { id: makeId(), ...preset }])
  }

  function updateZone(id: string, patch: Partial<TrainingZone>) {
    setZones(zones.map(z => (z.id === id ? { ...z, ...patch } as SessionZone : z)))
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
      <div className="flex flex-wrap gap-2">
        {(['warmup', 'main', 'rest'] as ZoneKind[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => addZone(k)}
            className="px-3 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
          >
            + {ZONE_KIND_LABEL[k]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setZones([...zones, makeDefaultRepeatZone()])}
          className="px-3 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
        >
          + Bloc Répéter
        </button>
        <button
          type="button"
          onClick={() => addZone('cooldown')}
          className="px-3 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
        >
          + {ZONE_KIND_LABEL.cooldown}
        </button>
      </div>

      {zones.length > 0 && <ZonePreviewBar zones={flattenZonesForPreview(zones)} />}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={zones.map(z => z.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {zones.map(z =>
              isRepeatZone(z) ? (
                <RepeatZoneCard
                  key={z.id}
                  zone={z}
                  sessionType={draft.type}
                  onChange={updated => setZones(zones.map(zz => (zz.id === updated.id ? updated : zz)))}
                  onDelete={() => removeZone(z.id)}
                />
              ) : (
                <SortableZoneRow
                  key={z.id}
                  zone={z}
                  onChange={patch => updateZone(z.id, patch)}
                  onDelete={() => removeZone(z.id)}
                  sessionType={draft.type}
                />
              ),
            )}
            {zones.length === 0 && (
              <div className="text-center text-trail-muted text-[12px] py-4">
                Ajoute des zones pour structurer le template.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableZoneRow({
  zone, onChange, onDelete, sessionType,
}: {
  zone: TrainingZone
  onChange: (patch: Partial<TrainingZone>) => void
  onDelete: () => void
  sessionType: SessionType
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
            <div className="flex flex-col gap-1">
              <DurationDistanceToggle
                value={zone.mode ?? 'duration'}
                onChange={(mode) => onChange({ mode })}
              />
              {(zone.mode ?? 'duration') === 'duration' ? (
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={Number.isFinite(zone.durationMin) ? zone.durationMin : 0}
                  onChange={e => onChange({ durationMin: Number(e.target.value) || 0 })}
                  placeholder="min"
                  aria-label="Durée en minutes"
                  className="w-full px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] focus:outline-none focus:border-trail-primary"
                />
              ) : (
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50}
                  value={zone.distanceM ?? ''}
                  onChange={e =>
                    onChange({
                      distanceM: e.target.value === '' ? undefined : Number(e.target.value) || 0,
                    })
                  }
                  placeholder="400"
                  aria-label="Distance en mètres"
                  className="w-full px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] focus:outline-none focus:border-trail-primary"
                />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <IntensityPaceToggle
                value={zone.intensityMode ?? getDefaultIntensityMode(sessionType)}
                onChange={(mode) => onChange({ intensityMode: mode })}
              />
              {(zone.intensityMode ?? getDefaultIntensityMode(sessionType)) === 'level' ? (
                <select
                  value={zone.intensity}
                  onChange={e => onChange({ intensity: Number(e.target.value) as IntensityLevel })}
                  aria-label="Niveau d'intensité"
                  className="w-full px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] focus:outline-none focus:border-trail-primary"
                >
                  {[1, 2, 3, 4, 5].map(i => (
                    <option key={i} value={i}>I{i} — {INTENSITY_LEVEL_LABELS[i as IntensityLevel]}</option>
                  ))}
                </select>
              ) : (
                <PaceField
                  value={zone.paceSecPerKm ?? null}
                  onChange={(p) => onChange({ paceSecPerKm: p ?? undefined })}
                />
              )}
            </div>
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
  draft: SessionTemplate
  setDraft: React.Dispatch<React.SetStateAction<SessionTemplate>>
}) {
  return (
    <Field label="Description">
      <textarea
        rows={8}
        value={draft.description ?? ''}
        onChange={e => setDraft({ ...draft, description: e.target.value })}
        placeholder="Description générique du template (consignes, intentions). Non transmise aux séances créées depuis ce template — utilise les Notes de la séance pour les consignes spécifiques."
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

function TypeBadge({ type, types }: { type: SessionType; types: ActivityType[] }) {
  const meta = resolveSessionMeta(type, types)
  return (
    <div
      style={{
        width: 140,
        height: 26,
        padding: '3px 8px',
        borderRadius: 8,
        border: '1px solid var(--trail-border)',
        background: 'var(--trail-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        boxSizing: 'border-box',
      }}
      aria-label={`Type : ${meta.label}`}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: meta.color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 12,
          color: meta.color,
          letterSpacing: '0.3px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {meta.label}
      </span>
    </div>
  )
}
