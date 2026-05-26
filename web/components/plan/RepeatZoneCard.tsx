'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RepeatStepEditor } from './RepeatStepEditor'
import { formatPace } from '@/lib/plan/pace-format'
import type { RepeatZone, RepeatStep, SessionType, IntensityLevel } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

type Props = {
  zone: RepeatZone
  sessionType: SessionType
  intensityModeDisabled?: boolean
  onChange: (zone: RepeatZone) => void
  onDelete: () => void
}

export function RepeatZoneCard({ zone, sessionType, intensityModeDisabled = false, onChange, onDelete }: Props) {
  const L = useT().plan
  const [editingStepId, setEditingStepId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 30 } }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = zone.steps.findIndex((s) => s.id === active.id)
    const newIdx = zone.steps.findIndex((s) => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    onChange({ ...zone, steps: arrayMove(zone.steps, oldIdx, newIdx) })
  }

  const addStep = () => {
    const last = zone.steps[zone.steps.length - 1]
    const stepKind: 'effort' | 'recovery' = last?.stepKind === 'effort' ? 'recovery' : 'effort'
    const newStep: RepeatStep = {
      id: Math.random().toString(36).slice(2),
      stepKind,
      mode: 'duration',
      durationMin: stepKind === 'recovery' ? 1 : 2,
      intensityMode: 'level',
      intensity: stepKind === 'effort' ? 5 : 1,
    }
    onChange({ ...zone, steps: [...zone.steps, newStep] })
  }

  const updateStep = (updated: RepeatStep) => {
    onChange({ ...zone, steps: zone.steps.map((s) => (s.id === updated.id ? updated : s)) })
    setEditingStepId(null)
  }

  const deleteStep = (id: string) => {
    onChange({ ...zone, steps: zone.steps.filter((s) => s.id !== id) })
  }

  const editingStep = editingStepId ? zone.steps.find((s) => s.id === editingStepId) ?? null : null

  return (
    <>
      <div className="rounded-[12px] border border-trail-border bg-trail-surface p-3 mb-2">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-trail-muted cursor-grab select-none" aria-hidden>⋮⋮</span>
          <span className="text-[13px] font-semibold text-trail-text">{L.repeatZoneTitle}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={zone.repeats}
            onChange={(e) => onChange({ ...zone, repeats: Math.max(1, Number(e.target.value) || 1) })}
            aria-label={L.repeatZoneRepeatsAria}
            className="w-14 px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] text-center focus:outline-none focus:border-trail-primary"
          />
          <span className="text-[13px] text-trail-muted">{L.repeatZoneRepeatsTimes}</span>
          <button
            type="button"
            onClick={onDelete}
            aria-label={L.repeatZoneDeleteAria}
            className="ml-auto text-trail-danger text-[12px] font-semibold hover:underline"
          >
            🗑
          </button>
        </div>

        {/* Steps */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={zone.steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {zone.steps.map((step) => (
                <SortableStepRow
                  key={step.id}
                  step={step}
                  L={L}
                  onEdit={() => setEditingStepId(step.id)}
                  onDelete={() => deleteStep(step.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add step */}
        <button
          type="button"
          onClick={addStep}
          className="mt-3 text-[12px] font-semibold text-trail-primary hover:underline"
        >
          {L.repeatZoneAddStep}
        </button>

        <label className="mt-3 flex items-center gap-2 text-[12px] text-trail-text">
          <input
            type="checkbox"
            checked={!!zone.skipLastRecovery}
            onChange={(e) => onChange({ ...zone, skipLastRecovery: e.target.checked })}
            aria-label={L.repeatZoneSkipLastAria}
          />
          <span title={L.repeatZoneSkipLastTitle}>
            {L.repeatZoneSkipLastLabel}
          </span>
        </label>
      </div>

      {editingStep && (
        <RepeatStepEditor
          step={editingStep}
          sessionType={sessionType}
          intensityModeDisabled={intensityModeDisabled}
          onSave={updateStep}
          onCancel={() => setEditingStepId(null)}
        />
      )}
    </>
  )
}

function SortableStepRow({
  step,
  L,
  onEdit,
  onDelete,
}: {
  step: RepeatStep
  L: Dict['plan']
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'pan-y' as const,
  }

  const defaultLabel = step.stepKind === 'effort' ? L.repeatStepDefaultLabelEffort : L.repeatStepDefaultLabelRecovery
  const valueText = step.mode === 'distance'
    ? `${step.distanceM ?? 0} m`
    : `${step.durationMin ?? 0} min`
  const intensityText = step.intensityMode === 'pace'
    ? `${formatPace(step.paceSecPerKm ?? null) || '—'} /km`
    : intensityLabelFromLevel(step.intensity, L)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-[10px] bg-trail-card border border-trail-border p-2 flex items-center gap-2"
    >
      <span
        {...attributes}
        {...listeners}
        className="text-trail-muted cursor-grab select-none"
        aria-hidden
      >
        ⋮⋮
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-trail-text truncate">
          {step.label || defaultLabel}
        </p>
        <p className="text-[11px] text-trail-muted">
          {valueText} · {intensityText}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-[12px] font-semibold text-trail-primary hover:underline"
      >
        {L.repeatStepEditBtn}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={L.repeatStepDeleteAria}
        className="text-trail-danger text-[12px] font-semibold hover:underline"
      >
        🗑
      </button>
    </div>
  )
}

function intensityLabelFromLevel(level: IntensityLevel | undefined, L: Dict['plan']): string {
  if (!level) return '—'
  return L.repeatStepIntensityShort[level]
}
