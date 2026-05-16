'use client'

// Bloc Structure de Prépa : timeline horizontale des mésocycles avec auto-distribution.
// Lit Race + TrainingPlan via storage helpers. Click sur un segment → expand.
// États vides : pas de course → message, course mais pas de plan → CTA générer.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Phase, Race, TrainingPlan } from '@/types/plan'
import { PHASE_DEFINITIONS, autoDistributePhases } from '@/lib/training/phases'
import { getCurrentPlan, getRace, saveCurrentPlan } from '@/lib/plan/storage'
import { PhaseEditorModal } from './PhaseEditorModal'

const MS_PER_DAY = 86_400_000
const MS_PER_WEEK = 7 * MS_PER_DAY

function parseISO(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getTime()
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function diffWeeks(startISO: string, endISO: string): number {
  const w = (parseISO(endISO) - parseISO(startISO)) / MS_PER_WEEK
  return Math.max(0, Math.round(w))
}

function formatDDMM(iso: string): string {
  // YYYY-MM-DD → JJ/MM
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function formatLongDate(iso: string): string {
  // YYYY-MM-DD → "12 mai 2026"
  if (!iso || iso.length < 10) return iso
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  const y = iso.slice(0, 4)
  const m = parseInt(iso.slice(5, 7), 10) - 1
  const d = parseInt(iso.slice(8, 10), 10)
  if (Number.isNaN(d) || m < 0 || m > 11) return iso
  return `${d} ${months[m]} ${y}`
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

type Props = {
  onChange?: () => void
  /**
   * Bumpé par le parent (PlanClient) quand une autre donnée du plan change
   * (race créée, séance déplacée…). Inclus dans les deps du reload pour
   * éviter d'avoir des blocs désynchronisés (cf. bug "race créée mais
   * StructurePrepa reste vide tant qu'on ne change pas d'onglet").
   */
  reloadKey?: number
}

export function StructurePrepaBlock({ onChange, reloadKey = 0 }: Props) {
  const [race, setRace] = useState<Race | null>(null)
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [focusPhaseId, setFocusPhaseId] = useState<string | undefined>(undefined)
  const [generating, setGenerating] = useState(false)

  const reload = useCallback(async () => {
    const [r, p] = await Promise.all([getRace(), getCurrentPlan()])
    setRace(r)
    setPlan(p)
    setLoaded(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [r, p] = await Promise.all([getRace(), getCurrentPlan()])
      if (cancelled) return
      setRace(r)
      setPlan(p)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  function handleSaved() {
    void reload()
    onChange?.()
  }

  function openEditor(phaseId?: string) {
    setFocusPhaseId(phaseId)
    setModalOpen(true)
  }

  async function handleGenerateInitial() {
    if (generating || !race) return
    setGenerating(true)
    try {
      const start = todayISO()
      const phases = autoDistributePhases(start, race.date)
      if (phases.length === 0) {
        // Dates invalides (course passée par ex.) → ouvre l'éditeur vide pour que l'user corrige.
        openEditor()
        return
      }
      const now = new Date().toISOString()
      const newPlan: TrainingPlan = {
        id: makeId(),
        athleteId: '',
        name: `Prépa ${race.name}`,
        goalRaceId: race.id,
        startDate: phases[0].startDate,
        endDate: phases[phases.length - 1].endDate,
        phases,
        createdAt: now,
        updatedAt: now,
      }
      await saveCurrentPlan(newPlan)
      await reload()
      onChange?.()
    } finally {
      setGenerating(false)
    }
  }

  // Calculs timeline.
  const timelineData = useMemo(() => {
    if (!plan || plan.phases.length === 0) return null
    const startMs = parseISO(plan.startDate)
    const endMs = parseISO(plan.endDate)
    const totalMs = endMs - startMs
    if (totalMs <= 0) return null
    const totalWeeks = diffWeeks(plan.startDate, plan.endDate)
    const nowMs = Date.now()
    const rawProgress = ((nowMs - startMs) / totalMs) * 100
    const todayProgress = rawProgress
    const segments = plan.phases.map((phase) => {
      const w = diffWeeks(phase.startDate, phase.endDate)
      return { phase, weeks: Math.max(1, w) }
    })
    return { startMs, endMs, totalMs, totalWeeks, todayProgress, segments }
  }, [plan])

  // ─── États vides ──────────────────────────────────────────────────────────
  if (!race) {
    return (
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <div className="flex flex-col items-center justify-center text-center py-6 px-4">
          <span className="text-[40px] leading-none mb-2" aria-hidden>🎯</span>
          <p className="text-[13px] text-trail-muted">
            Définis d&apos;abord ton objectif dans le bloc ci-dessus.
          </p>
        </div>
      </div>
    )
  }

  if (!plan || plan.phases.length === 0) {
    return (
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-trail-text"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}
          >
            STRUCTURE DE PRÉPA
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-6 px-4">
          <p className="text-[13px] text-trail-muted mb-4 max-w-xs">
            Génère automatiquement la structure de ta prépa depuis aujourd&apos;hui jusqu&apos;à ta course.
          </p>
          <button
            type="button"
            onClick={handleGenerateInitial}
            disabled={!loaded || generating}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Génération…' : 'Générer ma structure de prépa'}
          </button>
        </div>
        <PhaseEditorModal
          plan={plan}
          race={race}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      </div>
    )
  }

  // ─── Plan + phases : timeline composite ───────────────────────────────────
  const td = timelineData!
  const expandedPhase = expandedId ? plan.phases.find(p => p.id === expandedId) ?? null : null
  const todayInRange = td.todayProgress >= 0 && td.todayProgress <= 100

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-trail-text"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}
        >
          STRUCTURE DE PRÉPA
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-trail-muted">{td.totalWeeks} sem</span>
          <button
            type="button"
            onClick={() => openEditor()}
            className="text-[12px] font-semibold text-trail-primary hover:underline"
            aria-label="Régénérer ou éditer les phases"
          >
            🪄 Régénérer
          </button>
        </div>
      </div>

      {/* Timeline horizontale */}
      <div className="relative">
        <div
          className="flex w-full rounded-[8px] overflow-hidden relative"
          style={{ height: 36 }}
          aria-label="Phases du plan"
        >
          {td.segments.map(({ phase, weeks }) => {
            const def = PHASE_DEFINITIONS[phase.type]
            const isExpanded = expandedId === phase.id
            // Ratio largeur segment / largeur totale. Sous ~12% la place est trop
            // étroite pour le label (cible mobile ~360px → 12% ≈ 43px ; sur desktop
            // wider). On masque le texte au lieu de tronquer en "Fo…" illisible.
            const ratio = weeks / td.totalWeeks
            const showLabel = ratio >= 0.12
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => setExpandedId(prev => prev === phase.id ? null : phase.id)}
                className="relative flex items-center justify-center text-white text-[11px] font-semibold transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-trail-primary"
                style={{
                  flex: weeks,
                  backgroundColor: def.color,
                  opacity: isExpanded ? 1 : 0.92,
                  minWidth: 0,
                }}
                aria-label={`Phase ${phase.label}, ${weeks} semaines`}
                aria-expanded={isExpanded}
              >
                {showLabel && (
                  <span
                    className="truncate px-1"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                  >
                    {def.label} · {weeks}sem
                  </span>
                )}
              </button>
            )
          })}

          {/* Marqueur TODAY (caché si hors range) */}
          {todayInRange && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: `${td.todayProgress}%`,
                width: 2,
                background: 'var(--trail-primary)',
                transform: 'translateX(-1px)',
              }}
              aria-label="Aujourd'hui"
            >
              <span
                className="absolute text-trail-primary"
                style={{
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 10,
                  lineHeight: 1,
                }}
                aria-hidden
              >
                ▼
              </span>
            </div>
          )}

          {/* Marqueur RACE (drapeau à droite) */}
          <span
            className="absolute text-[14px] pointer-events-none"
            style={{ right: 2, top: '50%', transform: 'translateY(-50%)' }}
            aria-label="Course objectif"
          >
            🏁
          </span>
        </div>

        {/* Tick row : dates début de phase */}
        <div className="flex w-full mt-1">
          {td.segments.map(({ phase, weeks }) => (
            <div
              key={`tick-${phase.id}`}
              className="text-[10px] text-trail-muted truncate px-1"
              style={{ flex: weeks, minWidth: 0 }}
            >
              {formatDDMM(phase.startDate)}
            </div>
          ))}
        </div>
      </div>

      {/* Panneau expand */}
      {expandedPhase && (
        <div className="mt-3 p-3 rounded-[10px] bg-trail-surface border border-trail-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: PHASE_DEFINITIONS[expandedPhase.type].color }}
                aria-hidden
              />
              <h4
                className="text-trail-text truncate"
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16 }}
              >
                {expandedPhase.label}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setExpandedId(null)}
              className="text-[11px] text-trail-muted hover:text-trail-text"
              aria-label="Replier la phase"
            >
              ✕
            </button>
          </div>

          {expandedPhase.description && (
            <p className="text-[12px] text-trail-muted mb-3 leading-relaxed">
              {expandedPhase.description}
            </p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-trail-text mb-3">
            <span>
              <span className="text-trail-muted">Début → Fin :</span>{' '}
              {formatLongDate(expandedPhase.startDate)} → {formatLongDate(expandedPhase.endDate)}
            </span>
            <span>
              <span className="text-trail-muted">Durée :</span>{' '}
              {diffWeeks(expandedPhase.startDate, expandedPhase.endDate)} semaines
            </span>
            <span>
              <span className="text-trail-muted">Charge cible :</span>{' '}
              {expandedPhase.weeklyChargeTarget} TSS/sem
            </span>
            <span>
              <span className="text-trail-muted">Distance hebdo :</span>{' '}
              {expandedPhase.weeklyDistanceKmTarget} km
            </span>
            <span>
              <span className="text-trail-muted">D+ hebdo :</span>{' '}
              {expandedPhase.weeklyElevationMTarget} m
            </span>
          </div>

          <button
            type="button"
            onClick={() => openEditor(expandedPhase.id)}
            className="px-3 py-2 rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] font-semibold hover:border-trail-primary"
            aria-label={`Éditer la phase ${expandedPhase.label}`}
          >
            Éditer cette phase
          </button>
        </div>
      )}

      <PhaseEditorModal
        plan={plan}
        race={race}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setFocusPhaseId(undefined) }}
        onSaved={handleSaved}
        focusPhaseId={focusPhaseId}
      />
    </div>
  )
}
