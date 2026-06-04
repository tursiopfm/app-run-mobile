'use client'

import { createContext, useContext, useState, useEffect, useRef, startTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/i18n/I18nProvider'
import { usePreferences } from '@/lib/preferences/PreferencesProvider'
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

function readStoredWidths(storageKey: string): Record<string, 1 | 2> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return {}
    return JSON.parse(stored) as Record<string, 1 | 2>
  } catch {
    return {}
  }
}

function SortableBlock({ id, isDraggingAny, label, desktopCols = 1, onToggleWidth, children }: {
  id: string
  isDraggingAny: boolean
  label: string
  desktopCols?: 1 | 2
  onToggleWidth: () => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const [isPressed, setIsPressed] = useState(false)
  return (
    <div
      ref={setNodeRef}
      className={`group/block mb-2 break-inside-avoid ${desktopCols === 2 ? 'md:[column-span:all]' : ''}`}
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
          onPointerDownCapture={() => setIsPressed(true)}
          onPointerUp={() => setIsPressed(false)}
          onPointerCancel={() => setIsPressed(false)}
        >
          <div className="w-10 h-[5px] rounded-full bg-trail-muted hover:bg-trail-text transition-colors" />
        </div>
      </div>
      <button
        onClick={onToggleWidth}
        title={desktopCols === 2 ? 'Réduire' : 'Déployer'}
        aria-label={desktopCols === 2 ? 'Réduire le bloc' : 'Élargir le bloc'}
        className="hidden md:flex absolute bottom-1 right-1 z-10 w-5 h-5 items-center justify-center rounded-sm opacity-40 group-hover/block:opacity-80 hover:!opacity-100 transition-opacity cursor-pointer"
      >
        <svg viewBox="0 0 10 10" className="w-3 h-3 text-trail-muted">
          <path d="M10 0 L10 10 L0 10 Z" fill="currentColor" />
        </svg>
      </button>
      <div
        className="pt-4"
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
  const { notifyChange, onHydrated } = usePreferences()
  const orderStorage  = `${storageKey}_block_order`
  const hiddenStorage = `${storageKey}_hidden_blocks`
  const widthStorage  = `${storageKey}_block_widths`

  const [order,    setOrder]    = useState<string[]>(() => readStoredOrder(orderStorage, defaultOrder))
  const [hidden,   setHidden]   = useState<string[]>(() => readStoredHidden(hiddenStorage, defaultHidden))
  const [widths,   setWidths]   = useState<Record<string, 1 | 2>>(() => readStoredWidths(widthStorage))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showAdd,  setShowAdd]  = useState(false)

  const orderStorageRef  = useRef(orderStorage)
  const hiddenStorageRef = useRef(hiddenStorage)
  const widthStorageRef  = useRef(widthStorage)
  orderStorageRef.current  = orderStorage
  hiddenStorageRef.current = hiddenStorage
  widthStorageRef.current  = widthStorage

  useEffect(() => {
    return onHydrated(() => {
      startTransition(() => {
        setOrder(readStoredOrder(orderStorageRef.current, defaultOrder))
        setHidden(readStoredHidden(hiddenStorageRef.current, defaultHidden))
        setWidths(readStoredWidths(widthStorageRef.current))
      })
    })
  }, [onHydrated, defaultOrder, defaultHidden])

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
    notifyChange()
    startTransition(() => setOrder(next))
  }
  function handleDragCancel() { setActiveId(null); cleanupDragStyles() }
  function hide(id: string) {
    setHidden(prev => {
      const next = prev.includes(id) ? prev : [...prev, id]
      localStorage.setItem(hiddenStorage, JSON.stringify(next))
      notifyChange()
      return next
    })
  }
  function restore(id: string) {
    setHidden(prev => {
      const next = prev.filter(b => b !== id)
      localStorage.setItem(hiddenStorage, JSON.stringify(next))
      notifyChange()
      return next
    })
  }
  function toggleWidth(id: string, defaultCols: 1 | 2) {
    setWidths(prev => {
      const current = prev[id] ?? defaultCols
      const next = { ...prev, [id]: (current === 2 ? 1 : 2) as 1 | 2 }
      localStorage.setItem(widthStorage, JSON.stringify(next))
      notifyChange()
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
          <div className="md:columns-2 md:[column-gap:8px]">
            {visibleOrder.map(id => {
              const block = blocks.find(b => b.id === id)
              if (!block) return null
              const effectiveCols = widths[id] ?? block.desktopCols ?? 1
              return (
                <SortableBlock
                  key={id}
                  id={id}
                  label={block.label}
                  desktopCols={effectiveCols as 1 | 2}
                  isDraggingAny={activeId !== null}
                  onToggleWidth={() => toggleWidth(id, block.desktopCols ?? 1)}
                >
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
