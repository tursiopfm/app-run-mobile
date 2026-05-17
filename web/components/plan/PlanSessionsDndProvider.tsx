'use client'

// DnD context partagé entre VueSemaineBlock et BibliothequeSeancesBlock.
// Volontairement séparé du DnD top-level de BlockGrid pour éviter les croisements :
// les blocs sont rendus comme enfants de ce provider, donc useDraggable/useDroppable
// résolvent vers ce DndContext (le plus proche dans l'arbre React).
//
// 2 types de draggable distincts via active.data.current.type :
//   - 'planned-session'   : déplacement d'une séance existante entre 2 jours
//   - 'session-template'  : création depuis un template (catalogue → calendrier)
// Les drop targets (colonnes jour) ont l'id `day-${ISO date}`.

import { useState, type ReactNode } from 'react'
import {
  DndContext, pointerWithin, rectIntersection, MouseSensor, TouchSensor, useSensor, useSensors,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from '@dnd-kit/core'
import type { SessionTemplate } from '@/types/plan'
import { colors } from '@/lib/design/colors'

type ActiveSessionPayload = {
  type: 'planned-session'
  sessionId: string
  title: string
}

type ActiveTemplatePayload = {
  type: 'session-template'
  template: SessionTemplate
}

type ActivePayload = ActiveSessionPayload | ActiveTemplatePayload

type Props = {
  children: ReactNode
  onMoveSession: (sessionId: string, newDateISO: string) => void
  onCreateFromTemplate: (template: SessionTemplate, dateISO: string) => void
  // Appelée si une PlannedSession existante est droppée hors de toute cellule jour.
  // Effet : suppression de la séance.
  onDeleteSession: (sessionId: string) => void
}

// Extrait la date ISO d'un id de drop target `day-YYYY-MM-DD`.
function dayIdToISO(id: string | number): string | null {
  if (typeof id !== 'string') return null
  if (!id.startsWith('day-')) return null
  return id.slice(4)
}

// Stratégie de collision : on essaie d'abord pointerWithin (le curseur DOIT
// être à l'intérieur d'un droppable). Si rien, on tombe sur rectIntersection
// (l'élément draggué recouvre une cellule) — utile sur mobile où le doigt
// occulte une partie. Si rien non plus → `over` reste null → drop hors zone.
const pointerWithinElseRectIntersection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args)
  if (pointer.length > 0) return pointer
  return rectIntersection(args)
}

export function PlanSessionsDndProvider({
  children, onMoveSession, onCreateFromTemplate, onDeleteSession,
}: Props) {
  const sensors = useSensors(
    // Desktop : drag immédiat après petit déplacement souris.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Mobile : long-press 250ms pour distinguer drag d'un scroll vertical.
    // tolerance: 30 = annule l'activation si le doigt bouge > 30px pendant les
    // 250ms (cas scroll). Sinon (doigt ~stable) le drag s'arme correctement.
    // NB lesson 2026-05-15 : tolerance: 8 trop bas → annulation silencieuse
    // sur gestes naturels. Avec 30 on évite cet écueil tout en gardant un
    // appui long franc qui laisse le scroll natif passer.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 30 } }),
  )
  const [active, setActive] = useState<ActivePayload | null>(null)
  // true quand l'utilisateur draggue une séance existante ET qu'on n'est pas
  // au-dessus d'une cellule jour → relâcher = suppression (feedback visuel rouge).
  const [isDeleteIntent, setIsDeleteIntent] = useState(false)

  function handleDragStart(e: DragStartEvent) {
    const payload = e.active.data.current as ActivePayload | undefined
    if (payload && (payload.type === 'planned-session' || payload.type === 'session-template')) {
      setActive(payload)
    }
    setIsDeleteIntent(false)
  }

  function handleDragOver(e: DragOverEvent) {
    const payload = e.active.data.current as ActivePayload | undefined
    if (!payload || payload.type !== 'planned-session') {
      setIsDeleteIntent(false)
      return
    }
    const targetISO = e.over ? dayIdToISO(e.over.id) : null
    setIsDeleteIntent(targetISO === null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActive(null)
    setIsDeleteIntent(false)
    const payload = e.active.data.current as ActivePayload | undefined
    const targetISO = e.over ? dayIdToISO(e.over.id) : null
    if (!payload) return

    if (payload.type === 'planned-session') {
      if (targetISO === null) {
        // Drop hors zone valide → suppression
        onDeleteSession(payload.sessionId)
      } else {
        onMoveSession(payload.sessionId, targetISO)
      }
    } else if (payload.type === 'session-template' && targetISO) {
      onCreateFromTemplate(payload.template, targetISO)
    }
  }

  function handleDragCancel() {
    setActive(null)
    setIsDeleteIntent(false)
  }

  return (
    <DndContext
      sensors={sensors}
      // pointerWithin pour que `over` soit null dès que le curseur quitte une
      // cellule jour (clé pour détecter l'intent de suppression).
      // Fallback rectIntersection sur mobile / si pointerWithin ne renvoie
      // rien mais que l'élément draggable recouvre encore la cellule.
      collisionDetection={pointerWithinElseRectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active ? <GhostCard active={active} isDeleteIntent={isDeleteIntent} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function GhostCard({ active, isDeleteIntent }: { active: ActivePayload; isDeleteIntent: boolean }) {
  const label =
    active.type === 'planned-session'
      ? active.title
      : active.template.title

  if (isDeleteIntent) {
    return (
      <div
        className="rounded-[8px] px-2 py-1 text-[11px] font-semibold shadow-2xl flex items-center gap-1"
        style={{
          backgroundColor: 'rgba(220, 38, 38, 0.95)',  // red-600 fond opaque pour ressortir
          border: '2px solid #DC2626',
          color: '#FFFFFF',
          maxWidth: 220,
          pointerEvents: 'none',
        }}
        aria-label={`Relâcher pour supprimer ${label}`}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
        <span className="truncate">Supprimer · {label}</span>
      </div>
    )
  }

  return (
    <div
      className="rounded-[8px] px-2 py-1 text-[11px] font-semibold text-trail-text shadow-2xl"
      style={{
        backgroundColor: colors.cardBg,
        border: `1px solid ${colors.border}`,
        maxWidth: 200,
        opacity: 0.95,
        pointerEvents: 'none',
      }}
    >
      {label}
    </div>
  )
}
