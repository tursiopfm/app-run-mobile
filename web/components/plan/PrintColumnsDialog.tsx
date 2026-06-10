'use client'

// Fenêtre de personnalisation des colonnes du PDF : drag pour réordonner,
// case à cocher pour afficher/masquer. Persistance gérée par le parent.
import { createPortal } from 'react-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  PRINT_COL_DEFS, type PrintColConfig, type PrintColKey,
} from '@/lib/plan/print-columns'

type Props = {
  open: boolean
  config: PrintColConfig
  onChange: (next: PrintColConfig) => void
  onClose: () => void
}

function SortableRow({
  k, hidden, onToggle,
}: { k: PrintColKey; hidden: boolean; onToggle: () => void }) {
  const def = PRINT_COL_DEFS[k]
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: k })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex items-center gap-3 px-2 py-2 rounded-[10px] bg-trail-surface border border-trail-border"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Déplacer"
        className="cursor-grab active:cursor-grabbing text-trail-muted px-1 touch-none"
      >
        ⠿
      </button>
      <label className="flex items-center gap-2 flex-1 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!hidden}
          disabled={def.fixed}
          onChange={onToggle}
          className="w-4 h-4"
        />
        <span className={`text-body ${hidden ? 'text-trail-muted' : 'text-trail-text'}`}>{def.label}</span>
        {def.fixed && <span className="text-micro text-trail-faint">(toujours)</span>}
      </label>
    </div>
  )
}

export function PrintColumnsDialog({ open, config, onChange, onClose }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  if (!open || typeof document === 'undefined') return null

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldI = config.order.indexOf(active.id as PrintColKey)
    const newI = config.order.indexOf(over.id as PrintColKey)
    if (oldI < 0 || newI < 0) return
    onChange({ ...config, order: arrayMove(config.order, oldI, newI) })
  }

  const toggle = (k: PrintColKey) => {
    if (PRINT_COL_DEFS[k].fixed) return
    const hidden = config.hidden.includes(k)
      ? config.hidden.filter((x) => x !== k)
      : [...config.hidden, k]
    onChange({ ...config, hidden })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Personnaliser les colonnes du PDF"
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-md max-h-[90vh] overflow-y-auto p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />
        <h2 className="font-display text-[16px] font-semibold text-trail-text mb-1">Colonnes du PDF</h2>
        <p className="text-caption text-trail-muted mb-4">Glisse pour réordonner · coche pour afficher.</p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={config.order} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {config.order.map((k) => (
                <SortableRow key={k} k={k} hidden={config.hidden.includes(k)} onToggle={() => toggle(k)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-body font-semibold"
          >
            Terminé
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
