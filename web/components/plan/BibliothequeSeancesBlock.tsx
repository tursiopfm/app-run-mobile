'use client'

// Bloc Bibliothèque de séances : cartes templates draggables (system + custom).
// Le drag est consommé par PlanSessionsDndProvider parent (data.type = 'session-template').

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { SessionTemplate } from '@/types/plan'
import type { ActivityType } from '@/types/activity-types'
import { SESSION_TEMPLATES } from '@/lib/training/session-templates'
import {
  deleteCustomTemplate,
  getCustomTemplates,
  getHiddenSystemTemplateIds,
  hideSystemTemplate,
  TEMPLATES_CHANGED,
  unhideAllSystemTemplates,
} from '@/lib/plan/storage'
import { INTENSITY_LEVEL_COLORS } from '@/lib/activities/indicators'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { TemplateEditorModal } from './TemplateEditorModal'
import { ActivityTypesPrefsModal } from './ActivityTypesPrefsModal'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { BlockCard } from '@/components/blocks/BlockCard'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

// Nombre de templates affichés par défaut avant le bouton « Voir plus ».
// Volontairement bas (2) pour éviter que le bloc Bibliothèque domine la page
// quand l'utilisateur n'a pas filtré (« Tous » sélectionné).
const COLLAPSED_TEMPLATES_COUNT = 2

export function BibliothequeSeancesBlock() {
  const L = useT().plan
  const [custom, setCustom] = useState<SessionTemplate[]>([])
  const [hiddenSystemIds, setHiddenSystemIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | 'all'>('all')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [showAllTemplates, setShowAllTemplates] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null)

  const { types, visibleTypes, prefs, upsertPrefs, createCustom, deleteCustom, renameCustom } = useActivityTypes()
  const [prefsModalOpen, setPrefsModalOpen] = useState(false)

  // État de la dialog de confirmation (delete template ou reset défauts).
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string
    message: string
    confirmLabel?: string
    destructive?: boolean
    onConfirm: () => void | Promise<void>
  } | null>(null)

  const reload = useCallback(async () => {
    const c = await getCustomTemplates()
    setCustom(c)
    setHiddenSystemIds(getHiddenSystemTemplateIds())
  }, [])

  useEffect(() => { void reload() }, [reload])

  // Resync sur évènement broadcast (suppression en cascade depuis la modale
  // Personnaliser, ou autre composant qui mute des templates).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => { void reload() }
    window.addEventListener(TEMPLATES_CHANGED, handler)
    return () => window.removeEventListener(TEMPLATES_CHANGED, handler)
  }, [reload])

  const customIds = useMemo(() => new Set(custom.map(t => t.id)), [custom])
  const hiddenSet = useMemo(() => new Set(hiddenSystemIds), [hiddenSystemIds])

  // Merge system + custom : custom en premier. Les système masqués sont retirés.
  const allTemplates = useMemo<SessionTemplate[]>(() => {
    const visibleSystem = SESSION_TEMPLATES.filter(t => !hiddenSet.has(t.id))
    return [...custom, ...visibleSystem]
  }, [custom, hiddenSet])

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

  function requestDelete(template: SessionTemplate) {
    const isCustomTpl = customIds.has(template.id)
    const displayTitle = L.sessionTemplates[template.id]?.title ?? template.title
    setPendingConfirm({
      title: L.libDeleteTitle(displayTitle),
      message: isCustomTpl ? L.libDeleteMsgCustom : L.libDeleteMsgSystem,
      confirmLabel: L.libDeleteConfirm,
      destructive: true,
      onConfirm: async () => {
        if (isCustomTpl) {
          await deleteCustomTemplate(template.id)
        } else {
          hideSystemTemplate(template.id)
        }
        setPendingConfirm(null)
        void reload()
      },
    })
  }

  function requestResetDefaults() {
    setPendingConfirm({
      title: L.libResetDefaultsAria + ' ?',
      message: L.libResetMsg,
      confirmLabel: L.libResetConfirm,
      destructive: false,
      onConfirm: () => {
        unhideAllSystemTemplates()
        setPendingConfirm(null)
        void reload()
      },
    })
  }

  return (
    <BlockCard
      title={L.libTitle}
      helpTitle={L.libTitle}
      helpBody={
        <>
          <p className="mb-2">
            <strong className="text-trail-text">{L.libHelpBodyTitle}</strong> {L.libHelpBodyIntro}
          </p>
          <ul className="space-y-1.5 list-disc list-outside pl-5">
            <li><strong className="text-trail-text">{L.libHelpBodyCreate}</strong> {L.libHelpBodyCreateD}</li>
            <li><strong className="text-trail-text">{L.libHelpBodyStruct}</strong> {L.libHelpBodyStructD}</li>
            <li><strong className="text-trail-text">{L.libHelpBodyAdd}</strong> {L.libHelpBodyAddD}</li>
            <li><strong className="text-trail-text">{L.libHelpBodyPerso}</strong> {L.libHelpBodyPersoD}</li>
            <li><strong className="text-trail-text">{L.libHelpBodyDelete}</strong> {L.libHelpBodyDeleteD}</li>
          </ul>
          <button
            type="button"
            onClick={requestResetDefaults}
            disabled={hiddenSystemIds.length === 0}
            className="mt-4 w-full py-2 rounded-[10px] bg-trail-surface border border-trail-border text-[13px] font-semibold text-trail-text hover:border-trail-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {L.libResetDefaults}
            {hiddenSystemIds.length > 0 && <span className="ml-1 text-trail-muted">({hiddenSystemIds.length})</span>}
          </button>
        </>
      }
      rightSlot={
        <button
          type="button"
          onClick={openCreate}
          className="px-2 py-1 rounded-[8px] bg-trail-primary text-white text-[11px] font-semibold whitespace-nowrap"
          aria-label={L.libNewBtnAria}
        >{L.libNewBtn}</button>
      }
    >
      {/* ── Filtres pills (collapsibles) ─────────────────────────────────── */}
      <FilterBar
        visibleTypes={visibleTypes}
        types={types}
        selectedType={selectedType}
        filtersExpanded={filtersExpanded}
        onSelectType={setSelectedType}
        onToggleExpand={() => setFiltersExpanded(e => !e)}
        onOpenPrefs={() => setPrefsModalOpen(true)}
        L={L}
      />

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="mt-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={L.libSearchPh}
          className="w-full px-3 py-2 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
          aria-label={L.libSearchAria}
        />
      </div>

      {/* ── Grille ─────────────────────────────────────────────────────── */}
      {/* Par défaut on affiche les 2 premiers templates pour ne pas exploser
          la hauteur du bloc. Bouton « Voir plus » apparaît dès qu'il y a
          plus de 2 résultats. */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {(showAllTemplates ? filtered : filtered.slice(0, COLLAPSED_TEMPLATES_COUNT)).map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            types={types}
            isCustom={customIds.has(t.id)}
            onClick={() => openEdit(t)}
            onDelete={() => requestDelete(t)}
            L={L}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-trail-muted text-[12px] py-4">
            {L.libNoMatch}
          </div>
        )}
      </div>
      {filtered.length > COLLAPSED_TEMPLATES_COUNT && (
        <button
          type="button"
          onClick={() => setShowAllTemplates(v => !v)}
          aria-expanded={showAllTemplates}
          className="mt-2 w-full py-2 rounded-[8px] border border-trail-border bg-trail-surface text-trail-muted hover:text-trail-text hover:border-trail-primary text-[12px] font-semibold transition-colors"
        >
          {showAllTemplates ? L.libShowLess : L.libShowMore(filtered.length - COLLAPSED_TEMPLATES_COUNT)}
        </button>
      )}

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
          onRenameCustom={renameCustom}
          onClose={() => {
            setPrefsModalOpen(false)
            // Recharge templates : si l'user a supprimé un type custom, on a
            // aussi supprimé en cascade les templates qui l'utilisaient.
            void reload()
          }}
        />
      )}
      <ConfirmDialog
        open={pendingConfirm !== null}
        title={pendingConfirm?.title ?? ''}
        message={pendingConfirm?.message ?? ''}
        confirmLabel={pendingConfirm?.confirmLabel}
        destructive={pendingConfirm?.destructive}
        onConfirm={() => { void pendingConfirm?.onConfirm() }}
        onCancel={() => setPendingConfirm(null)}
      />
    </BlockCard>
  )
}

// ─── Sous-composants ────────────────────────────────────────────────────────
// Calcule la luminance perçue d'un hex (#RRGGBB) pour décider texte noir/blanc.
function pickTextColor(hex?: string): string {
  if (!hex) return '#fff'
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#fff'
  const v = parseInt(m[1], 16)
  const r = (v >> 16) & 0xff
  const g = (v >> 8) & 0xff
  const b = v & 0xff
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 150 ? '#000' : '#fff'
}

function FilterPill({
  active, onClick, label, isCustom, color,
}: {
  active?: boolean
  onClick: () => void
  label: string
  isCustom?: boolean
  color?: string
}) {
  let cls = 'flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors'
  let inlineStyle: React.CSSProperties = { scrollSnapAlign: 'start' }

  if (isCustom) {
    cls += ' border border-trail-border bg-transparent text-trail-muted hover:text-trail-text hover:border-trail-primary'
  } else if (active && color) {
    cls += ' border'
    inlineStyle = {
      ...inlineStyle,
      backgroundColor: color,
      borderColor: color,
      color: pickTextColor(color),
    }
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
      style={inlineStyle}
      className={cls}
    >
      {label}
    </button>
  )
}

// Barre de filtres avec collapse/expand fluide. Tous + ⚙ Personnalisé toujours
// visibles; toggle central avec chevron animé + badge count. Si un filtre custom
// est actif et qu'on collapse, on garde ce filtre visible pour ne pas perdre
// l'orientation visuelle.
function FilterBar({
  visibleTypes, types, selectedType, filtersExpanded,
  onSelectType, onToggleExpand, onOpenPrefs, L,
}: {
  visibleTypes: { slug: string; label: string }[]
  types: ActivityType[]
  selectedType: string | 'all'
  filtersExpanded: boolean
  onSelectType: (slug: string | 'all') => void
  onToggleExpand: () => void
  onOpenPrefs: () => void
  L: Dict['plan']
}) {
  const hasActiveFilter = selectedType !== 'all'
  const activeType = hasActiveFilter ? visibleTypes.find(t => t.slug === selectedType) : null
  // Pill orpheline (active mais retirée du visible-set) : on l'affiche tout de
  // même en peek si filtersExpanded=false, sinon elle disparaît visuellement.
  const peekActiveOnly = !filtersExpanded && activeType

  return (
    <div role="tablist" aria-label={L.libFilterByTypeAria}>
      {/* Rangée 1 : pills clés toujours visibles + toggle + peek du filtre actif */}
      <div
        className="flex items-center gap-2 overflow-x-auto md:overflow-visible -mx-1 px-1"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <FilterPill
          active={selectedType === 'all'}
          onClick={() => onSelectType('all')}
          label={L.libFilterAll}
        />

        {/* Peek du filtre actif quand collapsed (sinon on perd l'orientation) */}
        {peekActiveOnly && activeType && (
          <FilterPill
            key={`peek-${activeType.slug}`}
            active
            onClick={() => onSelectType(activeType.slug)}
            label={activeType.label}
            color={resolveSessionMeta(activeType.slug, types).color}
          />
        )}

        <ExpandToggle
          expanded={filtersExpanded}
          count={visibleTypes.length}
          onClick={onToggleExpand}
          L={L}
        />

        <FilterPill onClick={onOpenPrefs} label={L.libFilterCustom} isCustom />
      </div>

      {/* Rangée 2 : tous les types visibles, scrollable horizontalement avec
          scrollbar visible. Trick grid-template-rows 0fr ↔ 1fr pour animer
          l'ouverture sans figer la hauteur. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: filtersExpanded ? '1fr' : '0fr' }}
        aria-hidden={!filtersExpanded}
      >
        <div className="overflow-hidden">
          <div className="filter-bar-scroll mt-2 flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {visibleTypes.map(t => (
              <FilterPill
                key={t.slug}
                active={selectedType === t.slug}
                onClick={() => onSelectType(t.slug)}
                label={t.label}
                color={resolveSessionMeta(t.slug, types).color}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Toggle pill avec chevron qui pivote 180° à l'ouverture. Bordure trail-primary
// discrète + badge count quand collapsed (typo plus petite pour discrétion).
function ExpandToggle({
  expanded, count, onClick, L,
}: { expanded: boolean; count: number; onClick: () => void; L: Dict['plan'] }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={expanded ? L.libFilterCollapseAria : L.libFilterExpandAria(count)}
      className="group flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border border-trail-primary/40 bg-trail-primary/5 text-trail-primary text-[12px] font-semibold hover:bg-trail-primary/15 hover:border-trail-primary/70 transition-colors"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-transform duration-300"
        style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        aria-hidden
      >
        <polyline points="9 6 15 12 9 18" />
      </svg>
      {!expanded && (
        <span className="text-[10px] opacity-80 tabular-nums">{count}</span>
      )}
    </button>
  )
}

function TemplateCard({
  template, types, isCustom, onClick, onDelete, L,
}: {
  template: SessionTemplate
  types: ActivityType[]
  isCustom: boolean
  onClick: () => void
  onDelete: () => void
  L: Dict['plan']
}) {
  const meta = resolveSessionMeta(template.type, types)
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
      aria-label={L.libTemplateCardAria(L.sessionTemplates[template.id]?.title ?? template.title)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={L.libTemplateDeleteAria(L.sessionTemplates[template.id]?.title ?? template.title)}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-trail-card border border-trail-border text-trail-muted hover:text-trail-danger hover:border-trail-danger text-[11px] leading-none z-10"
      >
        ✕
      </button>
      <p className="text-[10px] font-semibold text-trail-muted uppercase tracking-wider pr-6">
        {meta.label}
      </p>
      <h4
        className="mt-1 text-[14px] text-trail-text leading-tight"
        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
      >
        {L.sessionTemplates[template.id]?.title ?? template.title}
      </h4>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-[2px] text-[10px] text-trail-muted">
        {template.defaultDuration > 0 && <span>{template.defaultDuration} min</span>}
        {template.defaultDistance != null && <span>{template.defaultDistance} km</span>}
        {template.defaultElevation != null && <span>{template.defaultElevation} m D+</span>}
      </div>
      <IntensityBar level={template.defaultIntensity} L={L} />
    </div>
  )
}

function IntensityBar({ level, L }: { level: 1 | 2 | 3 | 4 | 5; L: Dict['plan'] }) {
  const color = INTENSITY_LEVEL_COLORS[level]
  return (
    <div
      className="mt-2 flex gap-[2px]"
      aria-label={L.libIntensityBarAria(level)}
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
