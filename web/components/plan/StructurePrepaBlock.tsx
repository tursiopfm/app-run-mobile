'use client'

// Bloc Structure de prépa : timeline horizontale du macrocycle ACTIF, avec
// courses A/B/C affichées en dessous via <RaceMarkers />. Expand inline par
// segment montre les objectifs km/D+ par semaine en lecture seule (via JSONB
// legacy weekly_targets) et un bouton "Éditer ce cycle" qui ouvre le modal.
//
// Le composant ne fait pas de fetch lui-même : il reçoit activeMacrocycle et
// races en props (orchestration dans PlanClient).

import { Fragment, useMemo, useState } from 'react'
import { SquarePen } from 'lucide-react'
import type { Phase, Race, TrainingPlan } from '@/types/plan'
import { PHASE_DEFINITIONS, autoDistributePhases, getPhaseWeeks } from '@/lib/training/phases'
import { saveCurrentPlan, saveMacrocycle } from '@/lib/plan/storage'
import { BlockCard } from '@/components/blocks/BlockCard'
import { PhaseEditorModal } from './PhaseEditorModal'
import { RaceMarkers } from './RaceMarkers'

const MS_PER_DAY = 86_400_000
const MS_PER_WEEK = 7 * MS_PER_DAY

function parseISO(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getTime()
}

function diffWeeks(startISO: string, endISO: string): number {
  return Math.max(1, Math.ceil((parseISO(endISO) - parseISO(startISO)) / MS_PER_WEEK))
}

function formatDDMM(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function formatLongDate(iso: string): string {
  if (!iso || iso.length < 10) return iso
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  const y = iso.slice(0, 4)
  const m = parseInt(iso.slice(5, 7), 10) - 1
  const d = parseInt(iso.slice(8, 10), 10)
  if (Number.isNaN(d) || m < 0 || m > 11) return iso
  return `${d} ${months[m]} ${y}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `macro-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Trouve la course pour démarrer la prépa : priorité A future, sinon main race future,
// sinon priorité A passée la plus récente. Null si aucune course n'a été définie.
function pickGoalRace(races: Race[]): Race | null {
  const today = todayISO()
  const upcomingA = races.filter(r => r.priority === 'A' && r.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  if (upcomingA.length > 0) return upcomingA[0]
  const upcomingMain = races.filter(r => r.isMain && r.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  if (upcomingMain.length > 0) return upcomingMain[0]
  const pastA = races.filter(r => r.priority === 'A').sort((a, b) => b.date.localeCompare(a.date))
  if (pastA.length > 0) return pastA[0]
  return null
}

type Props = {
  activeMacrocycle: TrainingPlan | null
  races: Race[]
  onChange?: () => void
}

export function StructurePrepaBlock({ activeMacrocycle, races, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [focusPhaseId, setFocusPhaseId] = useState<string | undefined>(undefined)
  const [generating, setGenerating] = useState(false)

  function openEditor(phaseId?: string) {
    setFocusPhaseId(phaseId)
    setModalOpen(true)
  }

  const goalRace = useMemo<Race | null>(() => {
    if (!activeMacrocycle?.goalRaceId) return null
    return races.find(r => r.id === activeMacrocycle.goalRaceId) ?? null
  }, [activeMacrocycle, races])

  // Course candidate pour démarrer une prépa quand aucun macro n'existe encore.
  const seedRace = useMemo<Race | null>(() => pickGoalRace(races), [races])

  async function handleGenerateInitial() {
    if (generating) return
    setGenerating(true)
    try {
      // Cas 1 : aucun macro → on en crée un depuis la course objectif détectée.
      if (!activeMacrocycle) {
        if (!seedRace) return
        const start = todayISO()
        const end = seedRace.date
        const phases = autoDistributePhases(start, end)
        const now = new Date().toISOString()
        const newPlan: TrainingPlan = {
          id: makeId(),
          athleteId: '',
          name: `Prépa ${seedRace.name}`,
          goalRaceId: seedRace.id,
          startDate: start,
          endDate: end,
          phases,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        }
        await saveMacrocycle(newPlan)
        onChange?.()
        return
      }
      // Cas 2 : macro existant sans phases → on les génère.
      const start = activeMacrocycle.startDate
      const end = goalRace?.date ?? activeMacrocycle.endDate
      const phases = autoDistributePhases(start, end)
      if (phases.length === 0) {
        openEditor()
        return
      }
      const now = new Date().toISOString()
      const updated: TrainingPlan = {
        ...activeMacrocycle,
        phases,
        updatedAt: now,
      }
      await saveCurrentPlan(updated)
      onChange?.()
    } finally {
      setGenerating(false)
    }
  }

  const timelineData = useMemo(() => {
    if (!activeMacrocycle || activeMacrocycle.phases.length === 0) return null
    const startMs = parseISO(activeMacrocycle.startDate)
    const endMs = parseISO(activeMacrocycle.endDate)
    const totalMs = endMs - startMs
    if (totalMs <= 0) return null
    const totalWeeks = diffWeeks(activeMacrocycle.startDate, activeMacrocycle.endDate)
    const nowMs = Date.now()
    const todayProgress = ((nowMs - startMs) / totalMs) * 100
    const segments = activeMacrocycle.phases.map(phase => ({
      phase,
      weeks: diffWeeks(phase.startDate, phase.endDate),
    }))
    return { startMs, endMs, totalMs, totalWeeks, todayProgress, segments }
  }, [activeMacrocycle])

  const expandedPhase = useMemo<Phase | null>(() =>
    activeMacrocycle && expandedId
      ? activeMacrocycle.phases.find(p => p.id === expandedId) ?? null
      : null,
    [activeMacrocycle, expandedId])

  if (!activeMacrocycle) {
    if (!seedRace) {
      return (
        <BlockCard
          title="Structure de prépa"
          helpTitle="Cycles de prépa"
          helpBody="Définis une course objectif au-dessus pour démarrer ta prépa."
        >
          <div className="flex flex-col items-center justify-center text-center py-6 px-4">
            <span className="text-[40px] leading-none mb-2" aria-hidden>🎯</span>
            <p className="text-[13px] text-[color:var(--trail-muted)]">
              Définis d&apos;abord ta course objectif dans le bloc ci-dessus.
            </p>
          </div>
        </BlockCard>
      )
    }
    return (
      <BlockCard
        title="Structure de prépa"
        helpTitle="Cycles de prépa"
        helpBody="Découpe la prépa en mésocycles : foncier, développement, spécifique, affûtage, récupération."
      >
        <div className="flex flex-col items-center justify-center text-center py-6 px-4">
          <p className="text-[13px] text-[color:var(--trail-muted)] mb-4 max-w-xs">
            Génère ta prépa pour <span className="font-semibold text-[color:var(--trail-text)]">{seedRace.name}</span> ({seedRace.date}) depuis aujourd&apos;hui.
          </p>
          <button
            type="button"
            onClick={handleGenerateInitial}
            disabled={generating}
            className="inline-flex items-center justify-center w-11 h-11 rounded-[10px] bg-[color:var(--trail-primary)] text-white disabled:opacity-50"
            aria-label="Générer ma prépa"
          >
            <SquarePen size={20} aria-hidden />
          </button>
        </div>
      </BlockCard>
    )
  }

  if (activeMacrocycle.phases.length === 0) {
    return (
      <BlockCard
        title="Structure de prépa"
        helpTitle="Cycles de prépa"
        helpBody="Découpe le macrocycle en mésocycles : foncier, développement, spécifique, affûtage, récupération."
      >
        <div className="flex flex-col items-center justify-center text-center py-6 px-4">
          <p className="text-[13px] text-[color:var(--trail-muted)] mb-4 max-w-xs">
            Génère automatiquement la structure de ta prépa depuis aujourd&apos;hui jusqu&apos;à la course objectif.
          </p>
          <button
            type="button"
            onClick={handleGenerateInitial}
            disabled={generating}
            className="inline-flex items-center justify-center w-11 h-11 rounded-[10px] bg-[color:var(--trail-primary)] text-white disabled:opacity-50"
            aria-label="Générer ma structure de prépa"
          >
            <SquarePen size={20} aria-hidden />
          </button>
        </div>
        <PhaseEditorModal
          plan={activeMacrocycle}
          race={goalRace}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={() => { onChange?.(); setModalOpen(false) }}
        />
      </BlockCard>
    )
  }

  if (!timelineData) {
    return (
      <BlockCard
        title="Structure de prépa"
        helpTitle="Cycles de prépa"
        helpBody="Macrocycle de durée nulle ou inversée — édite les dates pour corriger."
      >
        <div className="flex flex-col items-center justify-center text-center py-6 px-4">
          <p className="text-[13px] text-[color:var(--trail-muted)]">
            Les dates du macrocycle sont invalides. Édite-le pour repartir d&apos;une plage cohérente.
          </p>
        </div>
      </BlockCard>
    )
  }

  const td = timelineData
  const todayInRange = td.todayProgress >= 0 && td.todayProgress <= 100

  return (
    <BlockCard
      title="Structure de prépa"
      helpTitle="Cycles de prépa"
      helpBody="Découpe le macrocycle en mésocycles : foncier, développement, spécifique, affûtage, récupération."
      rightSlot={
        <>
          <span
            className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-[color:var(--trail-surface)] text-[color:var(--trail-muted)] border border-[color:var(--trail-border)] tracking-wide"
            aria-label={`Durée totale ${td.totalWeeks} semaines`}
          >
            {td.totalWeeks} sem
          </span>
          <button
            type="button"
            onClick={() => openEditor()}
            className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] text-[color:var(--trail-primary)] hover:bg-[color:var(--trail-surface)] ml-1"
            aria-label="Éditer les cycles"
          >
            <SquarePen size={16} aria-hidden />
          </button>
        </>
      }
    >
      <div className="relative pt-9">
        {/* Barre des segments */}
        <div className="flex w-full rounded-[10px] overflow-hidden relative" style={{ height: 48 }} aria-label="Cycles du plan">
          {td.segments.map(({ phase, weeks }, idx) => {
            const def = PHASE_DEFINITIONS[phase.type]
            const isExpanded = expandedId === phase.id
            const ratio = weeks / td.totalWeeks
            const showLabel = ratio >= 0.12
            // Séparateur noir si le segment précédent a la même couleur (sinon on ne distinguerait pas la frontière).
            const prevDef = idx > 0 ? PHASE_DEFINITIONS[td.segments[idx - 1].phase.type] : null
            const needsSeparator = prevDef !== null && prevDef.color === def.color
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => setExpandedId(prev => prev === phase.id ? null : phase.id)}
                className="relative flex flex-col items-center justify-center text-white text-[11px] font-semibold transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--trail-primary)]"
                style={{
                  flex: weeks,
                  backgroundColor: def.color,
                  opacity: isExpanded ? 1 : 0.92,
                  minWidth: 0,
                  borderLeft: needsSeparator ? '2px solid #000' : undefined,
                }}
                aria-label={`Cycle ${phase.label}, ${weeks} semaines`}
                aria-expanded={isExpanded}
                title={`${def.label} · ${weeks}sem${phase.focus ? ` · ${phase.focus}` : ''}`}
              >
                {showLabel && (
                  <>
                    <span className="block w-full text-center truncate px-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}>
                      {def.label} · {weeks}sem
                    </span>
                    {phase.focus && (
                      <span className="block w-full text-center text-[9px] opacity-90 truncate px-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}>
                        {phase.focus}
                      </span>
                    )}
                  </>
                )}
              </button>
            )
          })}

          {todayInRange && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `calc(${td.todayProgress}% - 1.5px)`,
                top: -4,
                bottom: -4,
                width: 3,
                background: '#FFFFFF',
                boxShadow: '0 0 0 1.5px rgba(0,0,0,0.65), 0 0 6px rgba(255,255,255,0.4)',
              }}
              aria-label="Aujourd'hui"
            />
          )}
        </div>

        <div className="flex w-full mt-1">
          {td.segments.map(({ phase, weeks }) => (
            <div
              key={`tick-${phase.id}`}
              className="text-[10px] text-[color:var(--trail-muted)] truncate px-1"
              style={{ flex: weeks, minWidth: 0 }}
            >
              {formatDDMM(phase.startDate)}
            </div>
          ))}
        </div>

        <RaceMarkers races={races} macroStart={activeMacrocycle.startDate} macroEnd={activeMacrocycle.endDate} />
      </div>

      {/* Panneau expand read-only : objectifs km/D+ par semaine via JSONB */}
      {expandedPhase && (
        <div className="mt-3 p-3 rounded-[10px] bg-[color:var(--trail-surface)] border border-[color:var(--trail-border)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: PHASE_DEFINITIONS[expandedPhase.type].color }}
                aria-hidden
              />
              <h4 className="text-[color:var(--trail-text)] truncate" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16 }}>
                {expandedPhase.label}
              </h4>
              {expandedPhase.focus && (
                <span className="text-[11px] text-[color:var(--trail-muted)] truncate">· {expandedPhase.focus}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setExpandedId(null)}
              className="text-[11px] text-[color:var(--trail-muted)] hover:text-[color:var(--trail-text)]"
              aria-label="Replier le cycle"
            >
              ✕
            </button>
          </div>

          {expandedPhase.description && (
            <p className="text-[12px] text-[color:var(--trail-muted)] mb-3 leading-relaxed">
              {expandedPhase.description}
            </p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[color:var(--trail-text)] mb-3">
            <span><span className="text-[color:var(--trail-muted)]">Début → Fin :</span> {formatLongDate(expandedPhase.startDate)} → {formatLongDate(expandedPhase.endDate)}</span>
            <span><span className="text-[color:var(--trail-muted)]">Durée :</span> {diffWeeks(expandedPhase.startDate, expandedPhase.endDate)} sem</span>
          </div>

          {/* Objectifs hebdo km/D+ READ-ONLY */}
          <div className="mb-3">
            <div className="text-[11px] font-semibold text-[color:var(--trail-muted)] mb-2">
              Objectifs semaine par semaine
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 items-center text-[12px]">
              <span className="text-[10px] uppercase tracking-wide text-[color:var(--trail-muted)]">Semaine</span>
              <span className="text-[10px] uppercase tracking-wide text-[color:var(--trail-muted)] text-right">Km</span>
              <span className="text-[10px] uppercase tracking-wide text-[color:var(--trail-muted)] text-right">D+</span>
              {getPhaseWeeks(expandedPhase).map((w, i) => (
                <Fragment key={`${expandedPhase.id}-w${i}`}>
                  <span className="text-[color:var(--trail-text)]">
                    Sem {i + 1}
                    <span className="text-[color:var(--trail-muted)]"> · {formatDDMM(w.startISO)}</span>
                  </span>
                  <span className="text-right tabular-nums">{w.km} <span className="text-[10px] text-[color:var(--trail-muted)]">km</span></span>
                  <span className="text-right tabular-nums">{w.dPlus} <span className="text-[10px] text-[color:var(--trail-muted)]">m</span></span>
                </Fragment>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => openEditor(expandedPhase.id)}
            className="px-3 py-2 rounded-[8px] bg-[color:var(--trail-card)] border border-[color:var(--trail-border)] text-[color:var(--trail-text)] text-[12px] font-semibold hover:border-[color:var(--trail-primary)]"
            aria-label={`Éditer le cycle ${expandedPhase.label}`}
          >
            Éditer ce cycle
          </button>
        </div>
      )}

      <PhaseEditorModal
        plan={activeMacrocycle}
        race={goalRace}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setFocusPhaseId(undefined) }}
        onSaved={() => { onChange?.(); setModalOpen(false); setFocusPhaseId(undefined) }}
        focusPhaseId={focusPhaseId}
      />
    </BlockCard>
  )
}
