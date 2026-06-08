'use client'

// Bloc Bibliothèque de séances : cartes templates draggables (system + custom).
// Le drag est consommé par PlanSessionsDndProvider parent (data.type = 'session-template').

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SessionTemplate } from '@/types/plan'
import { SESSION_TEMPLATES } from '@/lib/training/session-templates'
import {
  deleteCustomTemplate,
  getCustomTemplates,
  getHiddenSystemTemplateIds,
  hideSystemTemplate,
  TEMPLATES_CHANGED,
  unhideAllSystemTemplates,
} from '@/lib/plan/storage'
import { TemplateEditorModal } from './TemplateEditorModal'
import { ActivityTypesPrefsModal } from './ActivityTypesPrefsModal'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { BlockCard } from '@/components/blocks/BlockCard'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useT } from '@/lib/i18n/I18nProvider'
import { TemplateCard } from '@/components/plan/library/TemplateCard'
import { FilterBar } from '@/components/plan/library/FilterBar'

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
            className="mt-4 w-full py-2 rounded-[10px] bg-trail-surface border border-trail-border text-body-sm font-semibold text-trail-text hover:border-trail-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="px-2 py-1 rounded-[8px] bg-trail-primary text-white text-micro font-semibold whitespace-nowrap"
          aria-label={L.libNewBtnAria}
        >{L.libNewBtn}</button>
      }
    >
      {/* ── Filtres pills (collapsibles) ─────────────────────────────────── */}
      <FilterBar
        variant="full"
        visibleTypes={visibleTypes}
        types={types}
        selectedType={selectedType}
        filtersExpanded={filtersExpanded}
        onSelectType={setSelectedType}
        onToggleExpand={() => setFiltersExpanded(e => !e)}
        onOpenPrefs={() => setPrefsModalOpen(true)}
      />

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="mt-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={L.libSearchPh}
          className="w-full px-3 py-2 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-body-sm focus:outline-none focus:border-trail-primary"
          aria-label={L.libSearchAria}
        />
      </div>

      {/* ── Grille ─────────────────────────────────────────────────────── */}
      {/* Par défaut on affiche les 2 premiers templates pour ne pas exploser
          la hauteur du bloc. Bouton « Voir plus » apparaît dès qu'il y a
          plus de 2 résultats. */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
        {(showAllTemplates ? filtered : filtered.slice(0, COLLAPSED_TEMPLATES_COUNT)).map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            types={types}
            isCustom={customIds.has(t.id)}
            mode="drag"
            onClick={() => openEdit(t)}
            onDelete={() => requestDelete(t)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-trail-muted text-caption py-4">
            {L.libNoMatch}
          </div>
        )}
      </div>
      {filtered.length > COLLAPSED_TEMPLATES_COUNT && (
        <button
          type="button"
          onClick={() => setShowAllTemplates(v => !v)}
          aria-expanded={showAllTemplates}
          className="mt-2 w-full py-2 rounded-[8px] border border-trail-border bg-trail-surface text-trail-muted hover:text-trail-text hover:border-trail-primary text-caption font-semibold transition-colors"
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

