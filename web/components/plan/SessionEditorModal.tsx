'use client'

// Modal d'édition / création d'une séance planifiée (PlannedSession).
// Pattern portal cohérent avec RaceEditorModal / PhaseEditorModal (Échap ferme).
// 3 tabs : Général, Structure (zones), Notes.

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { colors } from '@/lib/design/colors'
import type { MatchableActivity } from '@/lib/plan/session-matching'
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
  PlannedSession,
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
  deletePlannedSession,
  getCurrentPlan,
  savePlannedSession,
} from '@/lib/plan/storage'
import { estimateCharge } from '@/lib/training/charge'
import {
  INTENSITY_LEVEL_COLORS,
} from '@/lib/activities/indicators'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import type { ActivityType } from '@/types/activity-types'
import { DurationField } from '@/components/plan/DurationField'
import { DurationDistanceToggle } from '@/components/plan/DurationDistanceToggle'
import { IntensityPaceToggle } from '@/components/plan/IntensityPaceToggle'
import { PaceField } from '@/components/plan/PaceField'
import { getDefaultIntensityMode } from '@/lib/plan/type-helpers'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

type Tab = 'general' | 'structure' | 'notes'

type Props = {
  session: PlannedSession | null
  initialDate?: string
  open: boolean
  /**
   * Activité(s) automatiquement matchée(s) à cette séance (auto-link bloc Semaine).
   * 1 ou 2 entrées (2 = cumul aller+retour pour runtaf/velotaf).
   */
  matchedActivities?: MatchableActivity[] | null
  /** Délier les activités matchées — les paires sont gardées en LS pour ne plus être proposées. */
  onUnlink?: (sessionId: string, activityIds: string[]) => void
  /** Si fourni et session===null, initialise le draft depuis le template + bandeau "Pré-rempli depuis". Ignoré en mode édition. */
  prefillTemplate?: SessionTemplate | null
  onClose: () => void
  onSaved: () => void
}

function buildZonePresets(L: Dict['plan']): Record<ZoneKind, Omit<TrainingZone, 'id'>> {
  return {
    warmup:   { kind: 'warmup',   durationMin: 15, intensity: 2, label: L.zonePresetLabels.warmup },
    main:     { kind: 'main',     durationMin: 30, intensity: 4, label: L.zonePresetLabels.main },
    rest:     { kind: 'rest',     durationMin: 5,  intensity: 1, label: L.zonePresetLabels.rest },
    cooldown: { kind: 'cooldown', durationMin: 10, intensity: 1, label: L.zonePresetLabels.cooldown },
  }
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

function draftFromTemplate(tpl: SessionTemplate, initialDate: string | undefined): PlannedSession {
  return {
    id: '',
    planId: '',
    date: initialDate ?? todayISO(),
    type: tpl.type,
    title: tpl.title,
    duration: tpl.defaultDuration,
    distance: tpl.defaultDistance,
    elevation: tpl.defaultElevation,
    intensity: tpl.defaultIntensity,
    estimatedCharge: estimateCharge(tpl.defaultDuration, tpl.defaultIntensity, tpl.defaultElevation),
    zones: tpl.defaultZones,
    notes: undefined,
    status: 'planned',
    templateId: tpl.id,
  }
}

export function SessionEditorModal({
  session, initialDate, open, prefillTemplate, matchedActivities, onUnlink, onClose, onSaved,
}: Props) {
  const L = useT().plan
  const isEdit = session !== null
  const [draft, setDraft] = useState<PlannedSession>(
    () => session ?? (prefillTemplate ? draftFromTemplate(prefillTemplate, initialDate) : emptyDraft(initialDate))
  )
  const [tab, setTab] = useState<Tab>('general')
  const [saving, setSaving] = useState(false)
  const [chargeOverridden, setChargeOverridden] = useState(false)
  const { visibleTypes, types } = useActivityTypes()
  const intensityModeDisabled = !resolveSessionMeta(draft.type, types).isRunning

  useEffect(() => {
    if (open) {
      const base = session
        ?? (prefillTemplate ? draftFromTemplate(prefillTemplate, initialDate) : emptyDraft(initialDate))
      setDraft(base)
      setTab('general')
      setChargeOverridden(isEdit) // En édition, on respecte la valeur stockée tant qu'on ne change rien.
    }
  }, [open, session, initialDate, isEdit, prefillTemplate])

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

  const canSave = draft.title.trim().length > 0 && !saving

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
        title: draft.title.trim() || L.sessionDuplicateFallback,
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
      aria-label={isEdit ? L.sessionAriaEdit : L.sessionAriaCreate}
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold text-trail-text">
            {isEdit ? L.sessionEditTitle : L.sessionCreateTitle}
          </h2>
        </div>

        {isEdit && matchedActivities && matchedActivities.length > 0 && (
          <div
            className="flex items-center justify-between gap-3 mb-3 p-3 rounded-[10px] border"
            style={{
              backgroundColor: `${colors.greenOk}1A`,
              borderColor: `${colors.greenOk}66`,
            }}
            role="status"
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span
                aria-hidden="true"
                className="flex-shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold mt-[2px]"
                style={{ backgroundColor: colors.greenOk, color: '#fff', width: 18, height: 18 }}
              >
                ✓
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold" style={{ color: colors.greenOk }}>
                  {matchedActivities.length === 1
                    ? L.sessionMatchedOne
                    : L.sessionMatchedMany(matchedActivities.length)}
                </div>
                {matchedActivities.map(a => (
                  <Link
                    key={a.id}
                    href={`/activities/${a.id}`}
                    className="block text-[13px] text-trail-text hover:underline truncate"
                    title={a.name || L.sessionMatchedLinkAria}
                  >
                    {a.name || L.sessionMatchedLinkAria}
                    {' '}
                    <span className="text-trail-muted text-[11px]">
                      ({a.distanceKm.toFixed(1)} km
                      {a.elevationM > 0 ? ` · ${Math.round(a.elevationM)} m D+` : ''})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            {onUnlink && (
              <button
                type="button"
                onClick={() => onUnlink(draft.id, matchedActivities.map(a => a.id))}
                className="flex-shrink-0 px-2 py-1 rounded-[8px] text-[12px] font-semibold text-trail-muted border border-trail-border hover:text-trail-text hover:border-trail-primary"
                aria-label={matchedActivities.length === 1
                  ? L.sessionUnlinkAriaOne
                  : L.sessionUnlinkAriaMany}
              >
                {L.sessionUnlink}
              </button>
            )}
          </div>
        )}

        {!isEdit && prefillTemplate && (
          <div
            className="flex items-center gap-2 mb-3 p-2 rounded-[10px] border border-dashed"
            style={{
              backgroundColor: `${colors.chargeOrange}1A`,
              borderColor: `${colors.chargeOrange}66`,
              color: colors.chargeOrange,
            }}
            role="status"
          >
            <span className="text-[12px] font-semibold">
              {L.addPrefillBanner(L.sessionTemplates[prefillTemplate.id]?.title ?? prefillTemplate.title)}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div
          className="flex items-stretch rounded-[10px] bg-trail-surface border border-trail-border overflow-hidden mb-4"
          role="tablist"
          aria-label={L.sessionTabsAria}
        >
          <TabButton active={tab === 'general'}   onClick={() => setTab('general')}   label={L.sessionTabGeneral} />
          <TabButton active={tab === 'structure'} onClick={() => setTab('structure')} label={L.sessionTabStructure} />
          <TabButton active={tab === 'notes'}     onClick={() => setTab('notes')}     label={L.sessionTabNotes} />
        </div>

        {tab === 'general' && (
          <GeneralTab
            draft={draft}
            setDraft={setDraft}
            onChargeEdit={() => setChargeOverridden(true)}
            visibleTypes={visibleTypes}
            types={types}
            L={L}
          />
        )}
        {tab === 'structure' && (
          <StructureTab draft={draft} setDraft={setDraft} intensityModeDisabled={intensityModeDisabled} L={L} />
        )}
        {tab === 'notes' && (
          <NotesTab draft={draft} setDraft={setDraft} L={L} />
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
                aria-label={L.sessionDuplicateAria}
              >
                {L.sessionDuplicate}
              </button>
            )}
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-2 text-[13px] font-semibold text-trail-danger hover:underline disabled:opacity-50"
                aria-label={L.sessionDeleteAria}
              >
                {L.sessionDelete}
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
              {L.sessionCancel}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-[14px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {L.sessionSave}
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
  draft, setDraft, onChargeEdit, visibleTypes, types, L,
}: {
  draft: PlannedSession
  setDraft: React.Dispatch<React.SetStateAction<PlannedSession>>
  onChargeEdit: () => void
  visibleTypes: ActivityType[]
  types: ActivityType[]
  L: Dict['plan']
}) {
  const intensityColor = INTENSITY_LEVEL_COLORS[draft.intensity]
  return (
    <div className="space-y-3">
      <Field label={L.sessionTitleLabel} required>
        <input
          type="text"
          value={draft.title}
          onChange={e => setDraft({ ...draft, title: e.target.value })}
          placeholder={L.sessionTitlePh}
          className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
        />
      </Field>

      <Field label={L.sessionTypeLabel}>
        <div className="flex items-center gap-2">
          <select
            value={draft.type}
            onChange={e => {
              const nextType = e.target.value
              const nextMeta = resolveSessionMeta(nextType, types)
              setDraft({
                ...draft,
                type: nextType,
                intensity: nextMeta.defaultIntensity,
                zones: draft.zones?.map(z => {
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
              return (
                <optgroup key={cat} label={L.templateCatLabels[cat]}>
                  {optionsInCat.map(t => (
                    <option key={t.slug} value={t.slug}>{t.label}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          <TypeBadge type={draft.type} types={types} L={L} />
        </div>
      </Field>

      <Field label={L.sessionDateLabel} required>
        <input
          type="date"
          value={draft.date}
          onChange={e => setDraft({ ...draft, date: e.target.value })}
          className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label={L.sessionFieldDuration}>
          <DurationField value={draft.duration} onChange={(d) => setDraft({ ...draft, duration: d })} />
        </Field>
        <Field label={L.sessionFieldDistance}>
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
        <Field label={L.sessionFieldElevation}>
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

      <Field label={L.sessionIntensityLabel(L.intensityLevels[draft.intensity])}>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={draft.intensity}
          onChange={e => setDraft({ ...draft, intensity: Number(e.target.value) as IntensityLevel })}
          className="w-full"
          style={{ accentColor: intensityColor }}
          aria-label={L.sessionIntensityAria(draft.intensity, L.intensityLevels[draft.intensity])}
        />
      </Field>

      <Field label={L.sessionChargeLabel}>
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
  draft, setDraft, intensityModeDisabled = false, L,
}: {
  draft: PlannedSession
  setDraft: React.Dispatch<React.SetStateAction<PlannedSession>>
  intensityModeDisabled?: boolean
  L: Dict['plan']
}) {
  const zones = draft.zones ?? []
  const ZONE_PRESETS = buildZonePresets(L)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function setZones(next: SessionZone[]) {
    setDraft({ ...draft, zones: next.length > 0 ? next : undefined })
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
      {/* Boutons rapides — ordre : Échauffement / Bloc principal / Récup / Bloc Répéter / Retour calme */}
      <div className="flex flex-wrap gap-2">
        {(['warmup', 'main', 'rest'] as ZoneKind[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => addZone(k)}
            className="px-3 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
          >
            + {L.zoneKindLabels[k]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setZones([...zones, makeDefaultRepeatZone()])}
          className="px-3 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
        >
          {L.sessionStructureAddRepeat}
        </button>
        <button
          type="button"
          onClick={() => addZone('cooldown')}
          className="px-3 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
        >
          + {L.zoneKindLabels.cooldown}
        </button>
      </div>

      {/* Aperçu barre composite */}
      {zones.length > 0 && <ZonePreviewBar zones={flattenZonesForPreview(zones)} L={L} />}

      {/* Liste sortable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={zones.map(z => z.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {zones.map(z =>
              isRepeatZone(z) ? (
                <RepeatZoneCard
                  key={z.id}
                  zone={z}
                  sessionType={draft.type}
                  intensityModeDisabled={intensityModeDisabled}
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
                  intensityModeDisabled={intensityModeDisabled}
                  L={L}
                />
              ),
            )}
            {zones.length === 0 && (
              <div className="text-center text-trail-muted text-[12px] py-4">
                {L.sessionStructureEmpty}
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableZoneRow({
  zone, onChange, onDelete, sessionType, intensityModeDisabled = false, L,
}: {
  zone: TrainingZone
  onChange: (patch: Partial<TrainingZone>) => void
  onDelete: () => void
  sessionType: SessionType
  intensityModeDisabled?: boolean
  L: Dict['plan']
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
          aria-label={L.sessionStructureReorderAria(L.zoneKindLabels[zone.kind])}
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
              <span className="text-[11px] font-semibold text-trail-muted">{L.zoneKindLabels[zone.kind]}</span>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="text-[11px] font-semibold text-trail-danger hover:underline"
              aria-label={L.sessionStructureDeleteAria}
            >
              {L.sessionStructureDelete}
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
                  aria-label={L.sessionDurationAria}
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
                  aria-label={L.sessionDistanceAria}
                  className="w-full px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] focus:outline-none focus:border-trail-primary"
                />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <IntensityPaceToggle
                value={zone.intensityMode ?? getDefaultIntensityMode(sessionType)}
                onChange={(mode) => onChange({ intensityMode: mode })}
                disabled={intensityModeDisabled}
              />
              {(zone.intensityMode ?? getDefaultIntensityMode(sessionType)) === 'level' ? (
                <select
                  value={zone.intensity}
                  onChange={e => onChange({ intensity: Number(e.target.value) as IntensityLevel })}
                  aria-label={L.sessionIntensityZoneAria}
                  className="w-full px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] focus:outline-none focus:border-trail-primary"
                >
                  {[1, 2, 3, 4, 5].map(i => (
                    <option key={i} value={i}>{L.sessionIntensityOption(i, L.intensityLevels[i as IntensityLevel])}</option>
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
              <Field label={L.sessionStructureRepetitions}>
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
            <Field label={L.sessionStructureLabel}>
              <input
                type="text"
                value={zone.label ?? ''}
                onChange={e => onChange({ label: e.target.value })}
                placeholder={L.sessionStructureLabelPh}
                className="w-full px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] focus:outline-none focus:border-trail-primary"
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}

function ZonePreviewBar({ zones, L }: { zones: TrainingZone[]; L: Dict['plan'] }) {
  const totalSec = zones.reduce(
    (acc, z) => acc + (z.durationMin || 0) * (z.repeats ?? 1),
    0,
  )
  if (totalSec <= 0) return null

  return (
    <div className="rounded-[8px] bg-trail-surface border border-trail-border p-2">
      <div className="text-[10px] font-semibold text-trail-muted mb-1 uppercase tracking-wider">
        {L.sessionPreviewLabel}
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
  draft, setDraft, L,
}: {
  draft: PlannedSession
  setDraft: React.Dispatch<React.SetStateAction<PlannedSession>>
  L: Dict['plan']
}) {
  return (
    <Field label={L.sessionNotesLabel}>
      <textarea
        rows={8}
        value={draft.notes ?? ''}
        onChange={e => setDraft({ ...draft, notes: e.target.value })}
        placeholder={L.sessionNotesPh}
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

function TypeBadge({ type, types, L }: { type: SessionType; types: ActivityType[]; L: Dict['plan'] }) {
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
      aria-label={L.sessionTypeBadgeAria(meta.label)}
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
