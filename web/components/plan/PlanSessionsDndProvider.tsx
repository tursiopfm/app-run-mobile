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
  DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors,
  DragOverlay,
  type DragEndEvent, type DragStartEvent,
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
}

// Extrait la date ISO d'un id de drop target `day-YYYY-MM-DD`.
function dayIdToISO(id: string | number): string | null {
  if (typeof id !== 'string') return null
  if (!id.startsWith('day-')) return null
  return id.slice(4)
}

export function PlanSessionsDndProvider({
  children, onMoveSession, onCreateFromTemplate,
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

  function handleDragStart(e: DragStartEvent) {
    const payload = e.active.data.current as ActivePayload | undefined
    if (payload && (payload.type === 'planned-session' || payload.type === 'session-template')) {
      setActive(payload)
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setActive(null)
    const payload = e.active.data.current as ActivePayload | undefined
    const targetISO = e.over ? dayIdToISO(e.over.id) : null
    if (!payload || !targetISO) return

    if (payload.type === 'planned-session') {
      onMoveSession(payload.sessionId, targetISO)
    } else if (payload.type === 'session-template') {
      onCreateFromTemplate(payload.template, targetISO)
    }
  }

  function handleDragCancel() {
    setActive(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active ? <GhostCard active={active} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function GhostCard({ active }: { active: ActivePayload }) {
  const label =
    active.type === 'planned-session'
      ? active.title
      : active.template.title

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
