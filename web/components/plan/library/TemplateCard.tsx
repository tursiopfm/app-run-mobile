'use client'

import { useDraggable } from '@dnd-kit/core'
import type { SessionTemplate } from '@/types/plan'
import type { ActivityType } from '@/types/activity-types'
import { INTENSITY_LEVEL_COLORS } from '@/lib/activities/indicators'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

type Mode = 'drag' | 'pick'

export function TemplateCard({
  template, types, isCustom, mode, ariaLabel, onClick, onDelete,
}: {
  template: SessionTemplate
  types: ActivityType[]
  isCustom: boolean
  mode: Mode
  ariaLabel?: string
  onClick: () => void
  onDelete: () => void
}) {
  const L = useT().plan
  const meta = resolveSessionMeta(template.type, types)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${template.id}`,
    data: { type: 'session-template', template },
    disabled: mode === 'pick',
  })

  const dragProps = mode === 'drag' ? { ...attributes, ...listeners } : {}

  return (
    <div
      ref={mode === 'drag' ? setNodeRef : undefined}
      {...dragProps}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'pan-y' }}
      className={`relative rounded-[8px] border bg-trail-surface p-2 cursor-pointer transition-colors ${
        isCustom ? 'border-trail-primary/30 hover:border-trail-primary' : 'border-trail-border hover:border-trail-primary/40'
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? L.libTemplateCardAria(L.sessionTemplates[template.id]?.title ?? template.title)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {mode === 'drag' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={L.libTemplateDeleteAria(L.sessionTemplates[template.id]?.title ?? template.title)}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-trail-card border border-trail-border text-trail-muted hover:text-trail-danger hover:border-trail-danger text-[11px] leading-none z-10"
        >
          ✕
        </button>
      )}
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
    <div className="mt-2 flex gap-[2px]" aria-label={L.libIntensityBarAria(level)}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-[2px]"
          style={{ backgroundColor: i <= level ? color : 'var(--trail-border)' }}
        />
      ))}
    </div>
  )
}
