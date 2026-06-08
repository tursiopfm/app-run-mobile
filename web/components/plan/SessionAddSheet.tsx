'use client'

// Bottom-sheet picker : ouvert depuis le « + » d'une journée (vues semaine et mois).
// Deux chemins : CTA « Créer » (éditeur vierge) ou tap sur un template (éditeur pré-rempli).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SessionTemplate } from '@/types/plan'
import { SESSION_TEMPLATES } from '@/lib/training/session-templates'
import { getCustomTemplates, getHiddenSystemTemplateIds } from '@/lib/plan/storage'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { FilterBar } from '@/components/plan/library/FilterBar'
import { TemplateCard } from '@/components/plan/library/TemplateCard'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  open: boolean
  dateISO: string
  onClose: () => void
  onPickTemplate: (template: SessionTemplate) => void
  onCreateBlank: () => void
}

function formatLong(iso: string, months: readonly string[]): string {
  if (!iso || iso.length < 10) return iso
  const y = iso.slice(0, 4)
  const m = parseInt(iso.slice(5, 7), 10) - 1
  const d = parseInt(iso.slice(8, 10), 10)
  if (Number.isNaN(d) || m < 0 || m > 11) return iso
  return `${d} ${months[m]} ${y}`
}

export function SessionAddSheet({ open, dateISO, onClose, onPickTemplate, onCreateBlank }: Props) {
  const L = useT().plan
  const { visibleTypes, types } = useActivityTypes()

  const [custom, setCustom] = useState<SessionTemplate[]>([])
  const [hiddenSystemIds, setHiddenSystemIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | 'all'>('all')

  // Reset filters at each re-open.
  useEffect(() => {
    if (open) { setSearch(''); setSelectedType('all') }
  }, [open])

  // Fetch custom templates + hidden ids on open.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const c = await getCustomTemplates()
      if (cancelled) return
      setCustom(c)
      setHiddenSystemIds(getHiddenSystemTemplateIds())
    })()
    return () => { cancelled = true }
  }, [open])

  // ESC closes.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const customIds = useMemo(() => new Set(custom.map(t => t.id)), [custom])
  const hiddenSet = useMemo(() => new Set(hiddenSystemIds), [hiddenSystemIds])

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

  const isLibraryEmpty = allTemplates.length === 0

  const resetFilters = useCallback(() => {
    setSearch('')
    setSelectedType('all')
  }, [])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={L.addTitle}
    >
      <div
        className="bg-trail-surface border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mt-2 mb-1 md:hidden" />

        <div className="px-4 pt-2 pb-3 flex items-start justify-between border-b border-trail-border">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-trail-text">{L.addTitle}</h2>
            <p className="text-[12px] text-trail-muted mt-[2px]">{formatLong(dateISO, L.monthsFull)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={L.addCloseAria}
            className="w-7 h-7 rounded-full bg-trail-card border border-trail-border text-trail-muted hover:text-trail-text text-[14px] leading-none"
          >✕</button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          <button
            type="button"
            onClick={onCreateBlank}
            className="w-full py-3 rounded-[12px] bg-trail-primary text-white text-[14px] font-bold flex items-center justify-center hover:opacity-90"
          >
            {L.addCreateBtn}
          </button>

          <div className="flex items-center gap-2 my-4 text-trail-muted text-[11px] font-semibold uppercase tracking-wider">
            <div className="flex-1 h-px bg-trail-border" />
            <span>{L.addOrLibrary}</span>
            <div className="flex-1 h-px bg-trail-border" />
          </div>

          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={L.addSearchPh}
            className="w-full px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary mb-2"
            aria-label={L.libSearchAria}
          />

          <FilterBar
            variant="compact"
            visibleTypes={visibleTypes}
            types={types}
            selectedType={selectedType}
            onSelectType={setSelectedType}
          />

          {isLibraryEmpty ? (
            <div className="mt-6 text-center text-trail-muted text-[13px]">
              {L.addEmpty}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 text-center">
              <p className="text-trail-muted text-[13px] mb-2">{L.addNoMatch}</p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1.5 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
              >
                {L.addReset}
              </button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              {filtered.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  types={types}
                  isCustom={customIds.has(t.id)}
                  mode="pick"
                  ariaLabel={L.addPickAria(L.sessionTemplates[t.id]?.title ?? t.title)}
                  onClick={() => onPickTemplate(t)}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
