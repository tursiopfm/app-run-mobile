'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
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
import type { ActivityType, UserActivityPref } from '@/types/activity-types'
import type { IntensityLevel } from '@/types/plan'

type Draft = {
  slug: string
  label: string
  isVisible: boolean
  type: ActivityType
}

type Props = {
  types: ActivityType[]
  prefs: UserActivityPref[]
  onSave: (prefs: UserActivityPref[]) => void
  onCreateCustom: (input: {
    slug: string
    label: string
    defaultIntensity: IntensityLevel
    category?: ActivityType['category']
  }) => Promise<ActivityType>
  onDeleteCustom: (id: string) => Promise<void>
  onClose: () => void
}

export function ActivityTypesPrefsModal({
  types, prefs, onSave, onCreateCustom, onDeleteCustom, onClose,
}: Props) {
  const [drafts, setDrafts] = useState<Draft[]>(() => buildInitialDrafts(types, prefs))
  const [newLabel, setNewLabel] = useState('')
  const [newIntensity, setNewIntensity] = useState<IntensityLevel>(2)
  const [newCategory, setNewCategory] = useState<NonNullable<ActivityType['category']>>('other')

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 30 } }),
  )

  if (typeof document === 'undefined') return null

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = drafts.findIndex(d => d.slug === active.id)
    const newIdx = drafts.findIndex(d => d.slug === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    setDrafts(arrayMove(drafts, oldIdx, newIdx))
  }

  function toggleVisible(slug: string) {
    setDrafts(drafts.map(d => d.slug === slug ? { ...d, isVisible: !d.isVisible } : d))
  }

  async function addCustom() {
    const label = newLabel.trim()
    if (!label) return
    const slug = slugify(label) + '-' + Date.now().toString(36)
    const created = await onCreateCustom({
      slug,
      label,
      defaultIntensity: newIntensity,
      category: newCategory,
    })
    setDrafts([...drafts, { slug: created.slug, label: created.label, isVisible: true, type: created }])
    setNewLabel('')
    setNewIntensity(2)
    setNewCategory('other')
  }

  async function removeCustom(d: Draft) {
    if (d.type.isSystem) return
    await onDeleteCustom(d.type.id)
    setDrafts(drafts.filter(x => x.slug !== d.slug))
  }

  function save() {
    const result: UserActivityPref[] = drafts.map((d, idx) => ({
      activitySlug: d.slug,
      isVisible: d.isVisible,
      displayOrder: idx,
    }))
    onSave(result)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] sm:rounded-[16px] w-full max-w-md p-5 pb-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold text-trail-text">Personnaliser mes activités</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-trail-muted hover:text-trail-text text-[16px]"
          >✕</button>
        </div>

        <p className="text-[12px] text-trail-muted mb-3">
          Activités affichées dans la barre :
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={drafts.map(d => d.slug)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1 mb-4">
              {drafts.map(d => (
                <SortableRow
                  key={d.slug}
                  draft={d}
                  onToggle={() => toggleVisible(d.slug)}
                  onDelete={() => void removeCustom(d)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Ajout custom */}
        <div className="mb-4 p-3 rounded-[10px] bg-trail-surface border border-trail-border">
          <p className="text-[12px] font-semibold text-trail-text mb-2">+ Ajouter une activité</p>

          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Ex : Tennis"
            aria-label="Libellé de la nouvelle activité"
            className="w-full px-3 py-2 mb-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
          />

          <label className="block text-[11px] font-semibold text-trail-muted uppercase tracking-wider mb-1.5">
            Catégorie
          </label>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {(['run', 'bike', 'swim', 'other'] as const).map(c => {
              const labels: Record<typeof c, string> = { run: 'Run', bike: 'Vélo', swim: 'Natation', other: 'Autre' }
              const checked = newCategory === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewCategory(c)}
                  className={
                    'text-center py-2 px-1 rounded-[8px] text-[12px] font-semibold border transition-colors ' +
                    (checked
                      ? 'border-trail-primary bg-trail-primary/10 text-trail-primary'
                      : 'border-trail-border bg-trail-card text-trail-muted hover:text-trail-text')
                  }
                >
                  {labels[c]}
                </button>
              )
            })}
          </div>
          <p className="mb-3 text-[11px] text-trail-muted italic">
            Détermine si la séance compte dans les bulles km / D+ / durée du bloc Semaine (running uniquement).
          </p>

          <div className="flex items-center gap-2">
            <select
              value={newIntensity}
              onChange={(e) => setNewIntensity(Number(e.target.value) as IntensityLevel)}
              aria-label="Intensité par défaut de la nouvelle activité"
              className="px-2 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
            >
              <option value={1}>I1</option>
              <option value={2}>I2</option>
              <option value={3}>I3</option>
              <option value={4}>I4</option>
              <option value={5}>I5</option>
            </select>
            <button
              type="button"
              onClick={() => void addCustom()}
              disabled={!newLabel.trim()}
              className="flex-1 px-3 py-2 rounded-[8px] bg-trail-primary text-black text-[13px] font-semibold disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-[14px] font-semibold text-trail-text"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            className="px-3 py-2 rounded-[10px] bg-trail-primary text-black text-[14px] font-semibold"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SortableRow({
  draft, onToggle, onDelete,
}: { draft: Draft; onToggle: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: draft.slug })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'pan-y' as const,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-2 rounded-[8px] bg-trail-surface border border-trail-border"
    >
      <input
        type="checkbox"
        checked={draft.isVisible}
        onChange={onToggle}
        aria-label={`Afficher ${draft.label}`}
      />
      <span className="flex-1 text-[13px] text-trail-text truncate">{draft.label}</span>
      {draft.type.category && (
        <span className="text-[10px] px-1.5 py-[2px] rounded bg-trail-card border border-trail-border text-trail-muted uppercase tracking-wider whitespace-nowrap">
          {draft.type.category === 'run' ? 'RUN' : draft.type.category === 'bike' ? 'BIKE' : draft.type.category === 'swim' ? 'SWIM' : 'OTHER'}
        </span>
      )}
      {!draft.type.isSystem && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Supprimer ${draft.label}`}
          className="text-trail-danger text-[12px] font-semibold hover:underline"
        >
          🗑
        </button>
      )}
      <span
        {...attributes}
        {...listeners}
        className="text-trail-muted cursor-grab select-none px-1"
        aria-hidden
      >
        ⋮⋮
      </span>
    </div>
  )
}

function buildInitialDrafts(types: ActivityType[], prefs: UserActivityPref[]): Draft[] {
  const prefBySlug = new Map(prefs.map(p => [p.activitySlug, p]))
  const enriched = types.map((t, idx) => {
    const pref = prefBySlug.get(t.slug)
    return {
      draft: {
        slug: t.slug,
        label: t.label,
        isVisible: pref ? pref.isVisible : true,
        type: t,
      } as Draft,
      order: pref ? pref.displayOrder : 1000 + idx,
    }
  })
  return enriched.sort((a, b) => a.order - b.order).map(e => e.draft)
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}
