'use client'

// PlanClient = shell minimal. Toute la logique vit dans les blocs (web/components/plan/*).
//
// ─── Architecture DnD (important) ─────────────────────────────────────────
// BlockGrid instancie son propre <DndContext> (top-level) pour réordonner les blocs
// via @dnd-kit/sortable. Les sous-blocs VueSemaine + Bibliothèque ont besoin
// d'un DnD INTERNE (drag d'une carte template vers une colonne jour). Or
// @dnd-kit résout useDraggable/useDroppable vers le DndContext le plus proche
// dans l'arbre React, ce qui créerait un conflit si on rendait VueSemaine et
// Bibliothèque comme deux blocs BlockGrid séparés (leurs hooks tomberaient
// dans le DndContext de BlockGrid qui ne sait pas gérer les ids `day-…` /
// `template-…`).
//
// DÉCISION : on fusionne ces deux blocs en UN SEUL item BlockGrid
// (id `semaine-bibliotheque`) qui rend en interne <PlanSessionsDndProvider>.
// Ce provider possède son propre <DndContext> qui devient l'ancêtre direct
// des deux composants — donc useDraggable/useDroppable y résolvent
// proprement, sans collision avec le DndContext du BlockGrid.
// Trade-off : l'user ne peut pas réordonner VueSemaine et Bibliothèque
// indépendamment, mais le drag template → calendrier fonctionne.
// ─────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { BlockGrid, type BlockDef } from '@/components/blocks/BlockGrid'
import { ModeToggleBlock } from '@/components/plan/ModeToggleBlock'
import { ObjectifCourseBlock } from '@/components/plan/ObjectifCourseBlock'
import { StructurePrepaBlock } from '@/components/plan/StructurePrepaBlock'
import { VueSemaineBlock } from '@/components/plan/VueSemaineBlock'
import { BibliothequeSeancesBlock } from '@/components/plan/BibliothequeSeancesBlock'
import { ChargePlanifieeBlock } from '@/components/plan/ChargePlanifieeBlock'
import { PlanSessionsDndProvider } from '@/components/plan/PlanSessionsDndProvider'
import {
  getPlannedSessions,
  savePlannedSession,
} from '@/lib/plan/storage'
import { estimateCharge } from '@/lib/training/charge'
import type { PlannedSession, SessionTemplate } from '@/types/plan'
import { seedMockDataIfEmpty } from '@/lib/plan/mock-data'

const DEFAULT_ORDER = ['mode', 'objectif', 'structure', 'semaine-bibliotheque', 'charge']

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function PlanClient() {
  // Compteur incrémenté à chaque opération DnD (move / create depuis template).
  // Passé en prop aux blocs concernés pour forcer un re-fetch sans démonter.
  const [reloadKey, setReloadKey] = useState(0)
  const bumpReload = useCallback(() => setReloadKey(k => k + 1), [])

  // Seed mock en dev (no-op en prod sauf flag NEXT_PUBLIC_PLAN_MOCK=1).
  useEffect(() => {
    void (async () => {
      await seedMockDataIfEmpty()
      bumpReload()
    })()
  }, [bumpReload])

  // ─── Handler : déplacement d'une PlannedSession existante ────────────────
  const handleMoveSession = useCallback(async (sessionId: string, newDateISO: string) => {
    // On ne sait pas sur quelle semaine la session vit ; on cherche large autour de today.
    // Range = 1 an (±6 mois) — largement suffisant pour couvrir n'importe quelle semaine
    // affichée par VueSemaineBlock.
    const today = new Date()
    const from = new Date(today.getTime() - 180 * 86_400_000).toISOString().slice(0, 10)
    const to   = new Date(today.getTime() + 180 * 86_400_000).toISOString().slice(0, 10)
    const all = await getPlannedSessions(from, to)
    const session = all.find(s => s.id === sessionId)
    if (!session) return
    if (session.date === newDateISO) return
    const updated: PlannedSession = { ...session, date: newDateISO }
    await savePlannedSession(updated)
    bumpReload()
  }, [bumpReload])

  // ─── Handler : création d'une PlannedSession depuis un template ──────────
  const handleCreateFromTemplate = useCallback(async (template: SessionTemplate, dateISO: string) => {
    const newSession: PlannedSession = {
      id: makeId(),
      planId: '',
      date: dateISO,
      type: template.type,
      title: template.title,
      duration: template.defaultDuration,
      distance: template.defaultDistance,
      elevation: template.defaultElevation,
      intensity: template.defaultIntensity,
      estimatedCharge: estimateCharge(
        template.defaultDuration,
        template.defaultIntensity,
        template.defaultElevation,
      ),
      zones: template.defaultZones,
      status: 'planned',
      templateId: template.id,
    }
    await savePlannedSession(newSession)
    bumpReload()
  }, [bumpReload])

  const blocks: BlockDef[] = [
    {
      id: 'mode',
      label: 'Mode',
      emoji: '🧭',
      render: () => <ModeToggleBlock />,
    },
    {
      id: 'objectif',
      label: 'Objectif course',
      emoji: '🎯',
      render: () => <ObjectifCourseBlock onChange={bumpReload} />,
    },
    {
      id: 'structure',
      label: 'Structure de prépa',
      emoji: '🏗️',
      render: () => <StructurePrepaBlock onChange={bumpReload} reloadKey={reloadKey} />,
    },
    {
      id: 'semaine-bibliotheque',
      label: 'Semaine & Bibliothèque',
      emoji: '📅',
      render: () => (
        <PlanSessionsDndProvider
          onMoveSession={handleMoveSession}
          onCreateFromTemplate={handleCreateFromTemplate}
        >
          <div className="space-y-2">
            <VueSemaineBlock reloadKey={reloadKey} />
            <BibliothequeSeancesBlock />
          </div>
        </PlanSessionsDndProvider>
      ),
    },
    {
      id: 'charge',
      label: 'Charge planifiée',
      emoji: '⚡',
      render: () => <ChargePlanifieeBlock reloadKey={reloadKey} />,
    },
  ]

  return (
    <div className="px-3 py-3 max-w-lg mx-auto">
      <BlockGrid
        storageKey="plan"
        defaultOrder={DEFAULT_ORDER}
        blocks={blocks}
        addLabel="Ajouter un bloc"
      />
    </div>
  )
}
