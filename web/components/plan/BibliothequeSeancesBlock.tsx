'use client'

// Bloc Bibliothèque de séances : cartes templates draggables (system + custom).
// Le drag est consommé par PlanSessionsDndProvider parent (data.type = 'session-template').

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { SessionTemplate, SessionType } from '@/types/plan'
import { SESSION_TEMPLATES } from '@/lib/training/session-templates'
import { getCustomTemplates } from '@/lib/plan/storage'
import { INTENSITY_LEVEL_COLORS } from '@/lib/activities/indicators'
import TypeIndicator from '@/components/activity/TypeIndicator'
import { TemplateEditorModal } from './TemplateEditorModal'

const ALL_TYPES: SessionType[] = [
  'sortie_longue', 'fractionne', 'seuil_tempo', 'cotes', 'course', 'runtaf', 'velotaf',
]

export function BibliothequeSeancesBlock() {
  const [custom, setCustom] = useState<SessionTemplate[]>([])
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<SessionType | 'all'>('all')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null)

  const reload = useCallback(async () => {
    const c = await getCustomTemplates()
    setCustom(c)
  }, [])

  useEffect(() => { void reload() }, [reload])

  // Merge system + custom : custom en premier.
  const allTemplates = useMemo<SessionTemplate[]>(() => {
    return [...custom, ...SESSION_TEMPLATES]
  }, [custom])

  const customIds = useMemo(() => new Set(custom.map(t => t.id)), [custom])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allTemplates.filter(t => {
      if (selectedType !== 'all' && t.type !== selectedType) return false
      if (q.length > 0) {
        const inTitle = t.title.toLowerCase().includes(q)
        const inTags = (t.tags ?? []).some(tag => tag.toLowerCase().includes(q))
        if (!inTitle && !inTags) return false
      }
      return true
    })
  }, [allTemplates, search, selectedType])

  function openCreate() {
    setEditingTemplate(null)
    setEditorOpen(true)
  }

  function openEdit(template: SessionTemplate) {
    // Templates système : pas d'édition. Pour l'instant on no-op.
    if (!customIds.has(template.id)) return
    setEditingTemplate(template)
    setEditorOpen(true)
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3
          className="text-[16px] text-trail-text"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}
        >
          BIBLIOTHÈQUE
        </h3>
        <button
          type="button"
          onClick={openCreate}
          className="px-3 py-1 rounded-[8px] bg-trail-primary text-white text-[12px] font-semibold"
          aria-label="Créer un nouveau template de séance"
        >
          + Nouveau template
        </button>
      </div>

      {/* ── Filtres chips ──────────────────────────────────────────────── */}
      {/* flex-wrap pour éviter le slide horizontal (le bloc fait 2 lignes
          de chips au lieu de scroller — UX mobile préférée). */}
      <div className="flex flex-wrap items-center gap-1 pb-1" role="tablist" aria-label="Filtrer par type">
        <TypeChip
          active={selectedType === 'all'}
          onClick={() => setSelectedType('all')}
          label="Toutes"
        />
        {ALL_TYPES.map(t => (
          <TypeChip
            key={t}
            active={selectedType === t}
            onClick={() => setSelectedType(t)}
            type={t}
          />
        ))}
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="mt-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="w-full px-3 py-2 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
          aria-label="Rechercher dans la bibliothèque"
        />
      </div>

      {/* ── Grille ─────────────────────────────────────────────────────── */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {filtered.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            isCustom={customIds.has(t.id)}
            onClick={() => openEdit(t)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-trail-muted text-[12px] py-4">
            Aucun template ne correspond.
          </div>
        )}
      </div>

      <TemplateEditorModal
        template={editingTemplate}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { void reload() }}
      />
    </div>
  )
}

// ─── Sous-composants ────────────────────────────────────────────────────────
function TypeChip({
  active, onClick, label, type,
}: {
  active: boolean
  onClick: () => void
  label?: string
  type?: SessionType
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
        active
          ? 'border-trail-primary bg-trail-primary/15 text-trail-primary'
          : 'border-trail-border bg-trail-surface text-trail-muted hover:text-trail-text'
      }`}
      style={type ? { minWidth: 100 } : undefined}
    >
      {label ?? (type ? <span className="block"><TypeIndicator type={type} /></span> : null)}
    </button>
  )
}

function TemplateCard({
  template, isCustom, onClick,
}: {
  template: SessionTemplate
  isCustom: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${template.id}`,
    data: { type: 'session-template', template },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
      className={`rounded-[8px] border bg-trail-surface p-2 cursor-pointer transition-colors ${
        isCustom ? 'border-trail-primary/30 hover:border-trail-primary' : 'border-trail-border hover:border-trail-primary/40'
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Template ${template.title}${isCustom ? ' (personnalisé, éditable)' : ' (système, lecture seule)'} — glisser vers un jour pour planifier`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      <TypeIndicator type={template.type} />
      <h4
        className="mt-1 text-[14px] text-trail-text leading-tight"
        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
      >
        {template.title}
      </h4>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-[2px] text-[10px] text-trail-muted">
        <span>{template.defaultDuration} min</span>
        {template.defaultDistance != null && <span>{template.defaultDistance} km</span>}
        {template.defaultElevation != null && <span>{template.defaultElevation} m D+</span>}
      </div>
      <IntensityBar level={template.defaultIntensity} />
    </div>
  )
}

function IntensityBar({ level }: { level: 1 | 2 | 3 | 4 | 5 }) {
  const color = INTENSITY_LEVEL_COLORS[level]
  return (
    <div
      className="mt-2 flex gap-[2px]"
      aria-label={`Intensité ${level} sur 5`}
    >
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-[2px]"
          style={{
            backgroundColor: i <= level ? color : 'var(--trail-border)',
          }}
        />
      ))}
    </div>
  )
}
