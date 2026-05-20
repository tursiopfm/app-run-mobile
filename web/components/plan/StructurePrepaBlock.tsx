'use client'

// Bloc Structure de Prépa : timeline horizontale des mésocycles avec auto-distribution.
// Lit Race + TrainingPlan via storage helpers. Click sur un segment → expand.
// États vides : pas de course → message, course mais pas de plan → CTA générer.

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { SquarePen } from 'lucide-react'
import type { Phase, PhaseWeeklyTarget, Race, TrainingPlan } from '@/types/plan'
import { PHASE_DEFINITIONS, autoDistributePhases, getPhaseWeeks } from '@/lib/training/phases'
import { getCurrentPlan, getRace, saveCurrentPlan } from '@/lib/plan/storage'
import { BlockCard } from '@/components/blocks/BlockCard'
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
  // Brouillon local des cibles hebdo de la phase ouverte. On édite ici puis on
  // persiste onBlur (évite d'écrire à chaque keystroke + de remonter onChange
  // au parent à chaque touche, ce qui ferait remonter reloadKey en boucle).
  const [weeklyDraft, setWeeklyDraft] = useState<PhaseWeeklyTarget[]>([])
  const [draftKey, setDraftKey] = useState<string | null>(null)

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

  // Phase actuellement déroulée (calculée tôt pour pouvoir initialiser le
  // draft hebdo dans un useEffect appelé inconditionnellement, avant les
  // early returns "pas de course" / "pas de plan").
  const expandedPhase = useMemo<Phase | null>(
    () => (plan && expandedId)
      ? plan.phases.find(p => p.id === expandedId) ?? null
      : null,
    [plan, expandedId],
  )

  // Clé d'identité du draft hebdo : on ne re-init que si on change de phase
  // OU si les bornes de la phase changent (le nombre de semaines varie). On
  // exclut volontairement `weeklyTargets` de la clé pour ne pas réinitialiser
  // le draft pendant que l'utilisateur tape (cf. onBlur qui persiste).
  const expandedPhaseKey = expandedPhase
    ? `${expandedPhase.id}|${expandedPhase.startDate}|${expandedPhase.endDate}`
    : null

  useEffect(() => {
    if (!expandedPhase || !expandedPhaseKey) {
      if (draftKey !== null) {
        setWeeklyDraft([])
        setDraftKey(null)
      }
      return
    }
    if (draftKey === expandedPhaseKey) return
    const weeks = getPhaseWeeks(expandedPhase)
    setWeeklyDraft(weeks.map(w => ({ km: w.km, dPlus: w.dPlus })))
    setDraftKey(expandedPhaseKey)
  }, [expandedPhase, expandedPhaseKey, draftKey])

  const persistWeeklyTargets = useCallback(
    async (phaseId: string, targets: PhaseWeeklyTarget[]) => {
      if (!plan) return
      const updated: TrainingPlan = {
        ...plan,
        phases: plan.phases.map(p =>
          p.id === phaseId ? { ...p, weeklyTargets: [...targets] } : p,
        ),
        updatedAt: new Date().toISOString(),
      }
      await saveCurrentPlan(updated)
      setPlan(updated)
      onChange?.()
    },
    [plan, onChange],
  )

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
      <BlockCard
        title="Cycle de préparation"
        helpTitle="Phases de prépa"
        helpBody="Découpe le macrocycle en mésocycles : foncier, développement, spécifique, affûtage, récupération."
      >
        <div className="flex flex-col items-center justify-center text-center py-6 px-4">
          <span className="text-[40px] leading-none mb-2" aria-hidden>🎯</span>
          <p className="text-[13px] text-trail-muted">
            Définis d&apos;abord ton objectif dans le bloc ci-dessus.
          </p>
        </div>
      </BlockCard>
    )
  }

  if (!plan || plan.phases.length === 0) {
    return (
      <BlockCard
        title="Cycle de préparation"
        helpTitle="Phases de prépa"
        helpBody="Découpe le macrocycle en mésocycles : foncier, développement, spécifique, affûtage, récupération."
      >
        <div className="flex flex-col items-center justify-center text-center py-6 px-4">
          <p className="text-[13px] text-trail-muted mb-4 max-w-xs">
            Génère automatiquement la structure de ta prépa depuis aujourd&apos;hui jusqu&apos;à ta course.
          </p>
          <button
            type="button"
            onClick={handleGenerateInitial}
            disabled={!loaded || generating}
            aria-label="Générer ma structure de prépa"
            title="Générer ma structure de prépa"
            className="inline-flex items-center justify-center w-11 h-11 rounded-[10px] bg-trail-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SquarePen size={20} aria-hidden />
          </button>
        </div>
        <PhaseEditorModal
          plan={plan}
          race={race}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      </BlockCard>
    )
  }

  // ─── Plan + phases : timeline composite ───────────────────────────────────
  const td = timelineData!
  // `expandedPhase` est déjà calculé via useMemo plus haut (besoin de l'init
  // de draft hebdo avant les early returns).
  const todayInRange = td.todayProgress >= 0 && td.todayProgress <= 100

  return (
    <BlockCard
      title="Cycle de préparation"
      helpTitle="Phases de prépa"
      helpBody="Découpe le macrocycle en mésocycles : foncier, développement, spécifique, affûtage, récupération."
      rightSlot={
        <>
          <span className="text-[12px] text-trail-muted">{td.totalWeeks} sem</span>
          <button
            type="button"
            onClick={() => openEditor()}
            className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] text-trail-primary hover:bg-trail-surface ml-2"
            aria-label="Régénérer ou éditer les phases"
            title="Régénérer ou éditer les phases"
          >
            <SquarePen size={16} aria-hidden />
          </button>
        </>
      }
    >
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
              className="absolute rounded-full pointer-events-none"
              style={{
                left: `calc(${td.todayProgress}% - 2px)`,
                top: -3,
                bottom: -3,
                width: 4,
                backgroundColor: 'var(--trail-text)',
                boxShadow: '0 0 0 1.5px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.45)',
              }}
              aria-label="Aujourd'hui"
            />
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
          </div>

          {/* Objectifs hebdo : tableau éditable km + D+ pour chaque semaine
              de la phase. Persistance onBlur (cf. weeklyTargets). */}
          <div className="mb-3">
            <div className="text-[11px] font-semibold text-trail-muted mb-2">
              Objectifs semaine par semaine
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 items-center text-[12px]">
              <span className="text-[10px] uppercase tracking-wide text-trail-muted">Semaine</span>
              <span className="text-[10px] uppercase tracking-wide text-trail-muted text-right">Volume</span>
              <span className="text-[10px] uppercase tracking-wide text-trail-muted text-right">D+</span>
              {getPhaseWeeks(expandedPhase).map((w, i) => {
                const draft = weeklyDraft[i] ?? { km: w.km, dPlus: w.dPlus }
                return (
                  <Fragment key={`${expandedPhase.id}-w${i}`}>
                    <span className="text-trail-text">
                      Sem {i + 1}
                      <span className="text-trail-muted"> · {formatDDMM(w.startISO)}</span>
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min={0}
                        value={Number.isFinite(draft.km) ? draft.km : 0}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0
                          setWeeklyDraft(prev => {
                            const next = [...prev]
                            while (next.length <= i) next.push({ km: 0, dPlus: 0 })
                            next[i] = { ...next[i], km: v }
                            return next
                          })
                        }}
                        onBlur={() => persistWeeklyTargets(expandedPhase.id, weeklyDraft)}
                        className="w-[84px] pl-2 pr-[28px] py-1 rounded-[6px] bg-trail-card border border-trail-border text-trail-text text-right text-[12px] focus:outline-none focus:border-trail-primary"
                        aria-label={`Volume km — semaine ${i + 1}`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-trail-muted pointer-events-none">km</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        step="10"
                        min={0}
                        value={Number.isFinite(draft.dPlus) ? draft.dPlus : 0}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0
                          setWeeklyDraft(prev => {
                            const next = [...prev]
                            while (next.length <= i) next.push({ km: 0, dPlus: 0 })
                            next[i] = { ...next[i], dPlus: v }
                            return next
                          })
                        }}
                        onBlur={() => persistWeeklyTargets(expandedPhase.id, weeklyDraft)}
                        className="w-[84px] pl-2 pr-[24px] py-1 rounded-[6px] bg-trail-card border border-trail-border text-trail-text text-right text-[12px] focus:outline-none focus:border-trail-primary"
                        aria-label={`D+ m — semaine ${i + 1}`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-trail-muted pointer-events-none">m</span>
                    </div>
                  </Fragment>
                )
              })}
            </div>
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
    </BlockCard>
  )
}
