'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { ActivitiesBlock }  from './ActivitiesBlock'
import { GoalsBlock }       from './GoalsBlock'
import { WeeklyStatsBlock } from './WeeklyStatsBlock'
import { ChargeBlock }      from './ChargeBlock'
import { HistoryBlock }     from './HistoryBlock'
import { CumulBlock }       from './CumulBlock'
import { IntensityBlock }   from './IntensityBlock'
import { WeekBlock }        from './WeekBlock'
import { SPORT_CONFIG }     from '@/lib/design/sports'

import type { SportOverview, DaySession } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'

const ORDER_KEY  = 'cockpit_block_order'
const HIDDEN_KEY = 'cockpit_hidden_blocks'

type BlockId = 'activities' | 'goals' | 'weekly' | 'charge' | 'history' | 'cumul' | 'intensity' | 'week'

const DEFAULT_ORDER: BlockId[] = [
  'activities', 'goals', 'weekly', 'charge', 'history', 'cumul', 'intensity', 'week',
]

const BLOCK_META: Record<BlockId, { label: string; emoji: string }> = {
  activities: { label: 'Activités',        emoji: '🏅' },
  goals:      { label: 'Objectifs',        emoji: '🎯' },
  weekly:     { label: 'Volume & Ratio',   emoji: '📊' },
  charge:     { label: 'Charge',           emoji: '⚡' },
  history:    { label: 'Historique',       emoji: '📅' },
  cumul:      { label: 'Cumul mensuel',    emoji: '📈' },
  intensity:  { label: 'Intensité',        emoji: '🔥' },
  week:       { label: 'Semaine en cours', emoji: '🗓️' },
}

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  weekSessions:   DaySession[]
}

// ── Sortable wrapper ────────────────────────────────────────────────────────

function SortableBlock({
  id,
  isDraggingAny,
  children,
}: {
  id: BlockId
  isDraggingAny: boolean
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition: isDraggingAny ? transition : undefined,
        opacity:    isDragging ? 0 : 1,
        position:   'relative',
      }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-0 inset-x-0 z-10 flex justify-center items-center h-5 cursor-grab active:cursor-grabbing touch-none select-none"
        aria-label={`Déplacer le bloc ${BLOCK_META[id].label}`}
        style={{ touchAction: 'none' }}
      >
        <div className="flex gap-[3px] opacity-30">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="w-[3px] h-[3px] rounded-full bg-trail-muted" />
          ))}
        </div>
      </div>

      <div className="pt-4">{children}</div>
    </div>
  )
}

// ── Drag overlay card ──────────────────────────────────────────────────────

function DragCard({ id }: { id: BlockId }) {
  const { label, emoji } = BLOCK_META[id]
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-primary/60 shadow-2xl px-4 py-5 opacity-90">
      <span className="text-[15px] font-semibold text-trail-text">{emoji} {label}</span>
    </div>
  )
}

// ── Add-block panel ────────────────────────────────────────────────────────

function AddBlockPanel({
  hidden,
  onRestore,
  onClose,
}: {
  hidden: BlockId[]
  onRestore: (id: BlockId) => void
  onClose: () => void
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] w-full max-w-lg p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4" />
        <h2 className="text-[16px] font-semibold text-trail-text mb-4">Ajouter un bloc</h2>
        <div className="space-y-2">
          {hidden.map((id) => {
            const { label, emoji } = BLOCK_META[id]
            return (
              <button
                key={id}
                onClick={() => { onRestore(id); onClose() }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[10px] bg-trail-surface border border-trail-border hover:border-trail-primary transition-colors text-left"
              >
                <span className="text-[20px]">{emoji}</span>
                <span className="text-[14px] font-semibold text-trail-text">{label}</span>
                <span className="ml-auto text-trail-primary text-[20px] leading-none">+</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main grid ──────────────────────────────────────────────────────────────

export function DashboardGrid({ sportOverviews, weekSessions }: Props) {
  const [order,       setOrder]       = useState<BlockId[]>(DEFAULT_ORDER)
  const [hidden,      setHidden]      = useState<BlockId[]>([])
  const [activeId,    setActiveId]    = useState<BlockId | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)

  useEffect(() => {
    try {
      const storedOrder = localStorage.getItem(ORDER_KEY)
      if (storedOrder) {
        const parsed = JSON.parse(storedOrder) as BlockId[]
        setOrder([
          ...parsed.filter((id) => DEFAULT_ORDER.includes(id)),
          ...DEFAULT_ORDER.filter((id) => !parsed.includes(id)),
        ])
      }
      const storedHidden = localStorage.getItem(HIDDEN_KEY)
      if (storedHidden) setHidden(JSON.parse(storedHidden) as BlockId[])
    } catch {}
  }, [])

  const sensors = useSensors(
    useSensor(MouseSensor,  { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,  { activationConstraint: { delay: 500, tolerance: 8 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as BlockId)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(active.id as BlockId), prev.indexOf(over.id as BlockId))
      localStorage.setItem(ORDER_KEY, JSON.stringify(next))
      return next
    })
  }

  function hideBlock(id: BlockId) {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id]
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
      return next
    })
  }

  function restoreBlock(id: BlockId) {
    setHidden((prev) => {
      const next = prev.filter((b) => b !== id)
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
      return next
    })
  }

  const weeklyPoints = sportOverviews.all.weeklyPoints.map((w) => ({
    label: w.weekLabel, km: w.km, dPlus: w.dPlus,
  }))

  const visibleOrder = order.filter((id) => !hidden.includes(id))

  function renderBlock(id: BlockId) {
    switch (id) {
      case 'activities': return <ActivitiesBlock  sportOverviews={sportOverviews} onHide={() => hideBlock(id)} />
      case 'goals':      return <GoalsBlock        sportOverviews={sportOverviews} onHide={() => hideBlock(id)} />
      case 'weekly':     return <WeeklyStatsBlock  sportOverviews={sportOverviews} onHide={() => hideBlock(id)} />
      case 'charge':     return <ChargeBlock        sportOverviews={sportOverviews} onHide={() => hideBlock(id)} />
      case 'history':    return <HistoryBlock       sportOverviews={sportOverviews} weeklyPoints={weeklyPoints} onHide={() => hideBlock(id)} />
      case 'cumul':      return <CumulBlock         sportOverviews={sportOverviews} onHide={() => hideBlock(id)} />
      case 'intensity':  return <IntensityBlock     sportOverviews={sportOverviews} onHide={() => hideBlock(id)} />
      case 'week':       return <WeekBlock          sportOverviews={sportOverviews} allSessions={weekSessions} />
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {visibleOrder.map((id) => (
              <SortableBlock key={id} id={id} isDraggingAny={activeId !== null}>
                {renderBlock(id)}
              </SortableBlock>
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeId && <DragCard id={activeId} />}
        </DragOverlay>
      </DndContext>

      {/* Add block button — only shown when there are hidden blocks */}
      {hidden.length > 0 && (
        <button
          onClick={() => setShowAddPanel(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-[12px] border border-dashed border-trail-border text-trail-muted hover:border-trail-primary hover:text-trail-primary transition-colors"
        >
          <span className="text-[20px] leading-none">+</span>
          <span className="text-[14px] font-semibold">Ajouter un bloc</span>
        </button>
      )}

      {showAddPanel && (
        <AddBlockPanel
          hidden={hidden}
          onRestore={restoreBlock}
          onClose={() => setShowAddPanel(false)}
        />
      )}
    </>
  )
}
