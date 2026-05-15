'use client'

import { createContext, useContext, useState, useEffect, startTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type BlockDef = {
  id:     string
  label:  string
  emoji:  string
  render: () => ReactNode
}

type Props = {
  storageKey:    string                  // 'cockpit', 'charge', etc.
  defaultOrder:  string[]
  blocks:        BlockDef[]
  addLabel?:     string
  defaultHidden?: string[]
}

const BlockContext = createContext<{ hideSelf: () => void }>({ hideSelf: () => {} })
export function useBlockContext() { return useContext(BlockContext) }

function SortableBlock({ id, isDraggingAny, label, children }: {
  id: string
  isDraggingAny: boolean
  label: string
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
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
      <div className="absolute top-0 inset-x-0 z-10 flex justify-center items-center h-5 pointer-events-none">
        <div
          {...attributes}
          {...listeners}
          aria-label={`Déplacer le bloc ${label}`}
          className="cursor-grab active:cursor-grabbing select-none pointer-events-auto px-4 py-2"
          style={{ touchAction: 'none' }}
        >
          <div className="w-10 h-[5px] rounded-full bg-trail-muted hover:bg-trail-text transition-colors" />
        </div>
      </div>
      <div className="pt-4">{children}</div>
    </div>
  )
}

function DragCard({ label, emoji }: { label: string; emoji: string }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-primary/60 shadow-2xl px-4 py-5 opacity-90">
      <span className="text-[15px] font-semibold text-trail-text">{emoji} {label}</span>
    </div>
  )
}

function AddBlockPanel({
  hiddenBlocks, onRestore, onClose,
}: {
  hiddenBlocks: BlockDef[]
  onRestore: (id: string) => void
  onClose: () => void
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="bg-trail-card border border-trail-border rounded-t-[20px] w-full max-w-lg p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4" />
        <h2 className="text-[16px] font-semibold text-trail-text mb-4">Ajouter un bloc</h2>
        <div className="space-y-2">
          {hiddenBlocks.map((b) => (
            <button
              key={b.id}
              onClick={() => { onRestore(b.id); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-[10px] bg-trail-surface border border-trail-border hover:border-trail-primary transition-colors text-left"
            >
              <span className="text-[20px]">{b.emoji}</span>
              <span className="text-[14px] font-semibold text-trail-text">{b.label}</span>
              <span className="ml-auto text-trail-primary text-[20px] leading-none">+</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function BlockGrid({ storageKey, defaultOrder, blocks, addLabel = 'Ajouter un bloc', defaultHidden = [] }: Props) {
  const orderStorage  = `${storageKey}_block_order`
  const hiddenStorage = `${storageKey}_hidden_blocks`

  const [order,    setOrder]    = useState<string[]>(defaultOrder)
  const [hidden,   setHidden]   = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showAdd,  setShowAdd]  = useState(false)

  useEffect(() => {
    try {
      const storedOrder = localStorage.getItem(orderStorage)
      if (storedOrder) {
        const parsed = JSON.parse(storedOrder) as string[]
        const merged = [
          ...parsed.filter(id => defaultOrder.includes(id)),
          ...defaultOrder.filter(id => !parsed.includes(id)),
        ]
        // Skip si l'ordre stocké == défaut : pas de re-render inutile.
        const isSameAsDefault = merged.length === defaultOrder.length &&
          merged.every((id, i) => id === defaultOrder[i])
        if (!isSameAsDefault) {
          // startTransition : le setOrder déclenche le re-render des 12 blocs
          // (avec 5 charts Recharts à l'intérieur), ce qui est lourd. En
          // transition, React peut l'interrompre pour traiter les events
          // urgents (clicks BottomNav notamment) → évite que le router gèle.
          startTransition(() => setOrder(merged))
        }
      }
      const storedHidden = localStorage.getItem(hiddenStorage)
      if (storedHidden) {
        const parsedHidden = JSON.parse(storedHidden) as string[]
        if (parsedHidden.length > 0) {
          startTransition(() => setHidden(parsedHidden))
        }
      } else if (defaultHidden.length > 0) {
        startTransition(() => setHidden(defaultHidden))
      }
    } catch {}
  }, [orderStorage, hiddenStorage, defaultOrder, defaultHidden])

  // PointerSensor unifie souris + tactile. Le delay force un long-press sur la
  // poignée pour démarrer le drag, sans bloquer les autres taps.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  )

  // Cleanup défensif : @dnd-kit pose des inline-styles sur <html>/<body> pendant
  // le drag (touch-action, overflow, user-select, cursor). Si le cleanup natif
  // foire (touchcancel iOS, drag interrompu par un re-render, queue React mal
  // synchronisée), ces styles restent collés et toute la page devient
  // non-tappable. On nettoie de façon synchrone à la fin de chaque drag — pas
  // via useEffect car React peut différer l'effect d'une frame.
  function cleanupDragStyles() {
    const html = document.documentElement
    const body = document.body
    html.style.removeProperty('touch-action')
    html.style.removeProperty('user-select')
    html.style.removeProperty('-webkit-user-select')
    html.style.removeProperty('overflow')
    html.style.removeProperty('cursor')
    body.style.removeProperty('touch-action')
    body.style.removeProperty('user-select')
    body.style.removeProperty('-webkit-user-select')
    body.style.removeProperty('overflow')
    body.style.removeProperty('cursor')
  }

  // Backup async cleanup pour les rares cas où le sync est zappé.
  useEffect(() => { if (activeId === null) cleanupDragStyles() }, [activeId])

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as string) }
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    cleanupDragStyles()
    if (!over || active.id === over.id) return
    // Calcul + persistance synchrones, setOrder en transition pour ne pas
    // bloquer la file React (cf. commentaire dans le useEffect mount).
    const next = arrayMove(order, order.indexOf(active.id as string), order.indexOf(over.id as string))
    try { localStorage.setItem(orderStorage, JSON.stringify(next)) } catch {}
    startTransition(() => setOrder(next))
  }
  function handleDragCancel() { setActiveId(null); cleanupDragStyles() }
  function hide(id: string) {
    setHidden(prev => {
      const next = prev.includes(id) ? prev : [...prev, id]
      localStorage.setItem(hiddenStorage, JSON.stringify(next))
      return next
    })
  }
  function restore(id: string) {
    setHidden(prev => {
      const next = prev.filter(b => b !== id)
      localStorage.setItem(hiddenStorage, JSON.stringify(next))
      return next
    })
  }

  const visibleOrder = order.filter(id => !hidden.includes(id))
  const hiddenBlocks = blocks.filter(b => hidden.includes(b.id))
  const activeBlock  = blocks.find(b => b.id === activeId)

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        autoScroll={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {visibleOrder.map(id => {
              const block = blocks.find(b => b.id === id)
              if (!block) return null
              return (
                <SortableBlock key={id} id={id} label={block.label} isDraggingAny={activeId !== null}>
                  <BlockContext.Provider value={{ hideSelf: () => hide(id) }}>
                    {block.render()}
                  </BlockContext.Provider>
                </SortableBlock>
              )
            })}
          </div>
        </SortableContext>
        {/* dropAnimation=null : retire l'overlay immédiatement au drop pour éviter
            que son portail reste 200ms dans le DOM et intercepte des taps. */}
        <DragOverlay dropAnimation={null}>
          {activeBlock && <DragCard label={activeBlock.label} emoji={activeBlock.emoji} />}
        </DragOverlay>
      </DndContext>

      {hiddenBlocks.length > 0 && (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-[12px] border border-dashed border-trail-border text-trail-muted hover:border-trail-primary hover:text-trail-primary transition-colors"
        >
          <span className="text-[20px] leading-none">+</span>
          <span className="text-[14px] font-semibold">{addLabel}</span>
        </button>
      )}
      {showAdd && (
        <AddBlockPanel hiddenBlocks={hiddenBlocks} onRestore={restore} onClose={() => setShowAdd(false)} />
      )}
    </>
  )
}
