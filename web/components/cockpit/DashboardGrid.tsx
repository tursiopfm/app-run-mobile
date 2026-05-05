'use client'

import { useState, useEffect } from 'react'
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

import type { SportOverview, DaySession } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'

const ORDER_KEY = 'cockpit_block_order'

type BlockId = 'activities' | 'goals' | 'weekly' | 'charge' | 'history' | 'cumul' | 'intensity' | 'week'

const DEFAULT_ORDER: BlockId[] = [
  'activities', 'goals', 'weekly', 'charge', 'history', 'cumul', 'intensity', 'week',
]

const BLOCK_LABELS: Record<BlockId, string> = {
  activities: 'Activités',
  goals:      'Objectifs',
  weekly:     'Volume & Ratio',
  charge:     'Charge',
  history:    'Historique',
  cumul:      'Cumul mensuel',
  intensity:  'Intensité',
  week:       'Semaine en cours',
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
      {/* Drag handle — thin strip at top of each block */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-0 inset-x-0 z-10 flex justify-center items-center h-5 cursor-grab active:cursor-grabbing touch-none select-none"
        aria-label={`Déplacer le bloc ${BLOCK_LABELS[id]}`}
        style={{ touchAction: 'none' }}
      >
        <div className="flex gap-[3px] opacity-30">
          <span className="w-[3px] h-[3px] rounded-full bg-trail-muted" />
          <span className="w-[3px] h-[3px] rounded-full bg-trail-muted" />
          <span className="w-[3px] h-[3px] rounded-full bg-trail-muted" />
          <span className="w-[3px] h-[3px] rounded-full bg-trail-muted" />
          <span className="w-[3px] h-[3px] rounded-full bg-trail-muted" />
          <span className="w-[3px] h-[3px] rounded-full bg-trail-muted" />
        </div>
      </div>

      {/* Block content — padded top so content clears the handle */}
      <div className="pt-4">
        {children}
      </div>
    </div>
  )
}

// ── Overlay card shown while dragging ──────────────────────────────────────

function DragCard({ label }: { label: string }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-primary/60 shadow-2xl px-4 py-5 opacity-90">
      <div className="flex items-center gap-2">
        <span className="text-trail-muted text-[18px]">⠿</span>
        <span className="text-[15px] font-semibold text-trail-text">{label}</span>
      </div>
    </div>
  )
}

// ── Main grid ──────────────────────────────────────────────────────────────

export function DashboardGrid({ sportOverviews, weekSessions }: Props) {
  const [order, setOrder]         = useState<BlockId[]>(DEFAULT_ORDER)
  const [activeId, setActiveId]   = useState<BlockId | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ORDER_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as BlockId[]
        // Merge: keep stored order, append any new blocks not yet in stored list
        const merged = [
          ...parsed.filter((id) => DEFAULT_ORDER.includes(id)),
          ...DEFAULT_ORDER.filter((id) => !parsed.includes(id)),
        ]
        setOrder(merged)
      }
    } catch {}
  }, [])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 500, tolerance: 8 },
    }),
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

  const weeklyPoints = sportOverviews.all.weeklyPoints.map((w) => ({
    label: w.weekLabel,
    km:    w.km,
    dPlus: w.dPlus,
  }))

  function renderBlock(id: BlockId) {
    switch (id) {
      case 'activities': return <ActivitiesBlock  sportOverviews={sportOverviews} />
      case 'goals':      return <GoalsBlock        sportOverviews={sportOverviews} />
      case 'weekly':     return <WeeklyStatsBlock  sportOverviews={sportOverviews} />
      case 'charge':     return <ChargeBlock        sportOverviews={sportOverviews} />
      case 'history':    return <HistoryBlock       sportOverviews={sportOverviews} weeklyPoints={weeklyPoints} />
      case 'cumul':      return <CumulBlock         sportOverviews={sportOverviews} />
      case 'intensity':  return <IntensityBlock     sportOverviews={sportOverviews} />
      case 'week':       return <WeekBlock          sportOverviews={sportOverviews} allSessions={weekSessions} />
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {order.map((id) => (
            <SortableBlock key={id} id={id} isDraggingAny={activeId !== null}>
              {renderBlock(id)}
            </SortableBlock>
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeId && <DragCard label={BLOCK_LABELS[activeId]} />}
      </DragOverlay>
    </DndContext>
  )
}
