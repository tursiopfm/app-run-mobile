'use client'

// Bloc Bibliothèque de séances : cartes templates draggables (system + custom).
// Le drag est consommé par PlanSessionsDndProvider parent (data.type = 'session-template').

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { SessionTemplate } from '@/types/plan'
import { SESSION_TEMPLATES } from '@/lib/training/session-templates'
import { deleteCustomTemplate, getCustomTemplates } from '@/lib/plan/storage'
import { INTENSITY_LEVEL_COLORS, SESSION_TYPE_LABELS } from '@/lib/activities/indicators'
import { TemplateEditorModal } from './TemplateEditorModal'
import { ActivityTypesPrefsModal } from './ActivityTypesPrefsModal'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { BlockCard } from '@/components/blocks/BlockCard'

export function BibliothequeSeancesBlock() {
  const [custom, setCustom] = useState<SessionTemplate[]>([])
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | 'all'>('all')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null)

  const { types, visibleTypes, prefs, upsertPrefs, createCustom, deleteCustom } = useActivityTypes()
  const [prefsModalOpen, setPrefsModalOpen] = useState(false)

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
    // Custom : édition directe. Système : fork (id réinitialisé → la sauvegarde
    // créera un nouveau template custom à partir des valeurs système).
    if (customIds.has(template.id)) {
      setEditingTemplate(template)
    } else {
      setEditingTemplate({ ...template, id: '' })
    }
    setEditorOpen(true)
  }

  async function confirmAndDelete(template: SessionTemplate) {
    if (typeof window === 'undefined') return
    const ok = window.confirm(`Supprimer le template « ${template.title} » ?\n\nCette action est définitive.`)
    if (!ok) return
    await deleteCustomTemplate(template.id)
    void reload()
  }

  return (
    <BlockCard
      title="Bibliothèque"
      helpTitle="Bibliothèque de séances"
      helpBody={
        <>
          <p className="mb-2">
            <strong className="text-trail-text">Ta bibliothèque personnelle</strong> de séances, organisée par type d&apos;activité.
          </p>
          <ul className="space-y-1.5 list-disc list-outside pl-5">
            <li>
              <strong className="text-trail-text">Créer une séance</strong> — bouton «&nbsp;+ Nouveau&nbsp;» en haut → formulaire complet (type, durée, structure, notes).
            </li>
            <li>
              <strong className="text-trail-text">Structure</strong> — décomposer en segments : échauffement, blocs «&nbsp;Répéter&nbsp;» avec séries/récup, retour au calme.
            </li>
            <li>
              <strong className="text-trail-text">Ajouter au calendrier</strong> — appui long sur une séance puis glisser dans la semaine.
            </li>
            <li>
              <strong className="text-trail-text">Personnaliser</strong> — pill «&nbsp;⚙ Personnalisé&nbsp;» en fin de barre pour cocher/décocher ou ajouter des activités (Tennis, Yoga…).
            </li>
          </ul>
        </>
      }
      rightSlot={
        <button
          type="button"
          onClick={openCreate}
          className="px-2 py-1 rounded-[8px] bg-trail-primary text-white text-[11px] font-semibold whitespace-nowrap"
          aria-label="Créer un nouveau template de séance"
        >+ Nouveau</button>
      }
    >
      {/* ── Filtres pills ──────────────────────────────────────────────── */}
      <div
        className="flex md:flex-wrap items-center gap-2 overflow-x-auto md:overflow-visible pb-2 -mx-1 px-1"
        style={{ scrollSnapType: 'x mandatory' }}
        role="tablist"
        aria-label="Filtrer par type"
      >
        <FilterPill active={selectedType === 'all'} onClick={() => setSelectedType('all')} label="Tous" />
        {visibleTypes.map(t => (
          <FilterPill
            key={t.slug}
            active={selectedType === t.slug}
            onClick={() => setSelectedType(t.slug)}
            label={t.label}
          />
        ))}
        <FilterPill onClick={() => setPrefsModalOpen(true)} label="⚙ Personnalisé" isCustom />
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
            onDelete={() => void confirmAndDelete(t)}
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
      {prefsModalOpen && (
        <ActivityTypesPrefsModal
          types={types}
          prefs={prefs}
          onSave={(next) => {
            void upsertPrefs(next)
            setPrefsModalOpen(false)
          }}
          onCreateCustom={createCustom}
          onDeleteCustom={deleteCustom}
          onClose={() => setPrefsModalOpen(false)}
        />
      )}
    </BlockCard>
  )
}

// ─── Sous-composants ────────────────────────────────────────────────────────
function FilterPill({
  active, onClick, label, isCustom,
}: {
  active?: boolean
  onClick: () => void
  label: string
  isCustom?: boolean
}) {
  let cls = 'flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors'
  if (isCustom) {
    cls += ' border border-trail-border bg-transparent text-trail-muted hover:text-trail-text hover:border-trail-primary'
  } else if (active) {
    cls += ' bg-trail-primary text-white border border-trail-primary'
  } else {
    cls += ' bg-trail-surface border border-trail-border text-trail-muted hover:text-trail-text'
  }
  return (
    <button
      type="button"
      role="tab"
      aria-selected={!!active}
      onClick={onClick}
      style={{ scrollSnapAlign: 'start' }}
      className={cls}
    >
      {label}
    </button>
  )
}

function TemplateCard({
  template, isCustom, onClick, onDelete,
}: {
  template: SessionTemplate
  isCustom: boolean
  onClick: () => void
  onDelete: () => void
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
      // pan-y (et non 'none') laisse passer le scroll vertical natif. Le drag
      // touch reste OK car TouchSensor s'arme au long-press immobile (250 ms),
      // moment où dnd-kit prend le pointer-capture qui surclasse touch-action.
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'pan-y' }}
      className={`relative rounded-[8px] border bg-trail-surface p-2 cursor-pointer transition-colors ${
        isCustom ? 'border-trail-primary/30 hover:border-trail-primary' : 'border-trail-border hover:border-trail-primary/40'
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Template ${template.title} — cliquer pour éditer, glisser vers un jour pour planifier`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {isCustom && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Supprimer le template ${template.title}`}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-trail-card border border-trail-border text-trail-muted hover:text-trail-danger hover:border-trail-danger text-[11px] leading-none z-10"
        >
          ✕
        </button>
      )}
      <p className="text-[10px] font-semibold text-trail-muted uppercase tracking-wider pr-6">
        {SESSION_TYPE_LABELS[template.type]}
      </p>
      <h4
        className="mt-1 text-[14px] text-trail-text leading-tight"
        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
      >
        {template.title}
      </h4>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-[2px] text-[10px] text-trail-muted">
        {template.defaultDuration > 0 && <span>{template.defaultDuration} min</span>}
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
