'use client'

import { createContext, useContext, useState, useEffect, startTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/i18n/I18nProvider'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type BlockDef = {
  id:     string
  label:  string
  emoji:  string
  render: () => ReactNode
  desktopCols?: 1 | 2
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

// Lecture synchrone du localStorage pour le lazy init du useState. Retourne
// les défauts côté SSR (pas de window) ou en cas d'erreur — l'utilisateur
// recevra le bon ordre dès qu'il atteindra le client (mismatch suppressé).
function readStoredOrder(storageKey: string, defaultOrder: string[]): string[] {
  if (typeof window === 'undefined') return defaultOrder
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return defaultOrder
    const parsed = JSON.parse(stored) as string[]
    return [
      ...parsed.filter(id => defaultOrder.includes(id)),
      ...defaultOrder.filter(id => !parsed.includes(id)),
    ]
  } catch {
    return defaultOrder
  }
}

function readStoredHidden(storageKey: string, defaultHidden: string[]): string[] {
  if (typeof window === 'undefined') return defaultHidden
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored) as string[]
      if (parsed.length > 0) return parsed
    }
    return defaultHidden
  } catch {
    return defaultHidden
  }
}

function SortableBlock({ id, isDraggingAny, label, desktopCols = 1, children }: {
  id: string
  isDraggingAny: boolean
  label: string
  desktopCols?: 1 | 2
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  // Feedback visuel "attrapé" : scale léger sur le contenu dès le pointerdown,
  // avant même que distance:8 active le drag. onPointerDownCapture s'exécute en
  // phase capture donc ne conflicte pas avec le onPointerDown du PointerSensor
  // dnd-kit (qui est dans {...listeners}). Reset sur pointerup/cancel.
  const [isPressed, setIsPressed] = useState(false)
  return (
    <div
      ref={setNodeRef}
      className={desktopCols === 2 ? 'md:col-span-2' : ''}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition: isDraggingAny ? transition : undefined,
        opacity:    isDragging ? 0 : 1,
        position:   'relative',
      }}
    >
      <div className="absolute top-0 inset-x-0 z-10 flex justify-center items-center h-5 md:h-0 md:opacity-0 md:hover:opacity-100 md:hover:h-5 md:transition-all pointer-events-none">
        <div
          {...attributes}
          {...listeners}
          aria-label={`Déplacer le bloc ${label}`}
          className="cursor-grab active:cursor-grabbing select-none pointer-events-auto px-4 py-2"
          style={{ touchAction: 'none' }}
          onPointerDownCapture={() => setIsPressed(true)}
          onPointerUp={() => setIsPressed(false)}
          onPointerCancel={() => setIsPressed(false)}
        >
          <div className="w-10 h-[5px] rounded-full bg-trail-muted hover:bg-trail-text transition-colors" />
        </div>
      </div>
      <div
        className="pt-4 md:pt-0"
        style={{
          transform:       isPressed && !isDragging ? 'scale(0.95)' : 'scale(1)',
          transformOrigin: 'center top',
          transition:      'transform 120ms ease-out',
        }}
      >
        {children}
      </div>
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
  const addBlockLabel = useT().cockpit.addBlock
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="bg-trail-card border border-trail-border rounded-t-[20px] w-full max-w-lg p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4" />
        <h2 className="text-[16px] font-semibold text-trail-text mb-4">{addBlockLabel}</h2>
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

export function BlockGrid({ storageKey, defaultOrder, blocks, addLabel, defaultHidden = [] }: Props) {
  const t = useT()
  const resolvedAddLabel = addLabel ?? t.cockpit.addBlock
  const orderStorage  = `${storageKey}_block_order`
  const hiddenStorage = `${storageKey}_hidden_blocks`

  // Lecture localStorage en lazy init : la grille rend DIRECTEMENT dans
  // l'ordre persisté au premier paint client → pas de flash, pas de seconde
  // passe de re-render. Côté SSR (typeof window === 'undefined') on retombe
  // sur les défauts ; cela génère un mismatch d'hydratation sur cold-load
  // (rare en PWA, l'app est déjà montée) qui est suppressé par le
  // suppressHydrationWarning du wrapper et React reconcilie le DOM client.
  // Sur nav client-side (cas du clic BottomNav, le plus fréquent), il n'y a
  // pas d'hydratation : useState init tourne directement avec localStorage
  // disponible → premier render = configuration utilisateur.
  const [order,    setOrder]    = useState<string[]>(() => readStoredOrder(orderStorage, defaultOrder))
  const [hidden,   setHidden]   = useState<string[]>(() => readStoredHidden(hiddenStorage, defaultHidden))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showAdd,  setShowAdd]  = useState(false)

  // Activation par distance (pas par delay) : sur touch, un geste naturel bouge
  // > 8 px en < 250 ms, ce qui faisait abandonner silencieusement l'activation
  // avec `{ delay, tolerance }` — la poignée semblait "morte" au doigt.
  // Avec `{ distance }`, le drag s'active dès 8 px de mouvement. La poignée a
  // déjà `touch-action: none` donc pas de conflit avec un scroll natif.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
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
    // Persistance synchrone, setOrder en transition : le re-render des 12
    // blocs (5 Recharts) est lourd ; transition = interruptible donc les
    // events urgents (clicks BottomNav) ne sont pas gelés.
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
    <div suppressHydrationWarning>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        autoScroll={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={visibleOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            {visibleOrder.map(id => {
              const block = blocks.find(b => b.id === id)
              if (!block) return null
              return (
                <SortableBlock key={id} id={id} label={block.label} desktopCols={block.desktopCols} isDraggingAny={activeId !== null}>
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
          <span className="text-[14px] font-semibold">{resolvedAddLabel}</span>
        </button>
      )}
      {showAdd && (
        <AddBlockPanel hiddenBlocks={hiddenBlocks} onRestore={restore} onClose={() => setShowAdd(false)} />
      )}
    </div>
  )
}
