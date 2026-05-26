'use client'

import type { ActivityType } from '@/types/activity-types'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

type BaseProps = {
  visibleTypes: { slug: string; label: string }[]
  types: ActivityType[]
  selectedType: string | 'all'
  onSelectType: (slug: string | 'all') => void
}

type FullProps = BaseProps & {
  variant: 'full'
  filtersExpanded: boolean
  onToggleExpand: () => void
  onOpenPrefs: () => void
}

type CompactProps = BaseProps & {
  variant: 'compact'
}

export type FilterBarProps = FullProps | CompactProps

export function FilterBar(props: FilterBarProps) {
  const L = useT().plan
  const activityLabels = useT().activities.sessionTypeLabels as Record<string, string>
  const typeLabel = (slug: string, fallback: string) => activityLabels[slug] ?? fallback

  if (props.variant === 'compact') {
    return (
      <div role="tablist" aria-label={L.libFilterByTypeAria}>
        <div
          className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          <FilterPill
            active={props.selectedType === 'all'}
            onClick={() => props.onSelectType('all')}
            label={L.libFilterAll}
          />
          {props.visibleTypes.map(t => (
            <FilterPill
              key={t.slug}
              active={props.selectedType === t.slug}
              onClick={() => props.onSelectType(t.slug)}
              label={typeLabel(t.slug, t.label)}
              color={resolveSessionMeta(t.slug, props.types).color}
            />
          ))}
        </div>
      </div>
    )
  }

  // variant === 'full' — preserves original behavior
  const { filtersExpanded, onToggleExpand, onOpenPrefs } = props
  const hasActiveFilter = props.selectedType !== 'all'
  const activeType = hasActiveFilter
    ? props.visibleTypes.find(t => t.slug === props.selectedType)
    : null
  const peekActiveOnly = !filtersExpanded && activeType

  return (
    <div role="tablist" aria-label={L.libFilterByTypeAria}>
      {/* Rangée 1 : pills clés toujours visibles + toggle + peek du filtre actif */}
      <div
        className="flex items-center gap-2 overflow-x-auto md:overflow-visible -mx-1 px-1"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <FilterPill
          active={props.selectedType === 'all'}
          onClick={() => props.onSelectType('all')}
          label={L.libFilterAll}
        />

        {/* Peek du filtre actif quand collapsed */}
        {peekActiveOnly && activeType && (
          <FilterPill
            key={`peek-${activeType.slug}`}
            active
            onClick={() => props.onSelectType(activeType.slug)}
            label={typeLabel(activeType.slug, activeType.label)}
            color={resolveSessionMeta(activeType.slug, props.types).color}
          />
        )}

        <ExpandToggle
          expanded={filtersExpanded}
          count={props.visibleTypes.length}
          onClick={onToggleExpand}
          L={L}
        />

        <FilterPill onClick={onOpenPrefs} label={L.libFilterCustom} isCustom ariaLabel={L.libFilterCustom} />
      </div>

      {/* Rangée 2 : tous les types visibles, collapse/expand animé */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: filtersExpanded ? '1fr' : '0fr' }}
        aria-hidden={!filtersExpanded}
      >
        <div className="overflow-hidden">
          <div className="filter-bar-scroll mt-2 flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {props.visibleTypes.map(t => (
              <FilterPill
                key={t.slug}
                active={props.selectedType === t.slug}
                onClick={() => props.onSelectType(t.slug)}
                label={typeLabel(t.slug, t.label)}
                color={resolveSessionMeta(t.slug, props.types).color}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

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
  active, onClick, label, isCustom, color, ariaLabel,
}: {
  active?: boolean
  onClick: () => void
  label: string
  isCustom?: boolean
  color?: string
  ariaLabel?: string
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
      aria-label={ariaLabel}
      onClick={onClick}
      style={inlineStyle}
      className={cls}
    >
      {label}
    </button>
  )
}

function ExpandToggle({
  expanded, count, onClick, L,
}: {
  expanded: boolean
  count: number
  onClick: () => void
  L: Dict['plan']
}) {
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
