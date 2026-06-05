'use client'

// Bloc Résumé semaine : récapitule la semaine sélectionnée (objectifs vs prévus
// vs restant) avec navigation jour + bouton Aujourd'hui. Lit les vraies données
// via lib/plan/storage (PlannedSession[], TrainingPlan, Race principale).
//
// Périmètre : RUNNING UNIQUEMENT — résolu via lib/plan/session-meta
// (catégorie 'run' pour les types builtin ET les types custom user). Vélo /
// natation / renfo / muscu sont exclus des totaux (km / D+ / charge) ET du
// compteur de séances, pour rester cohérent avec les cibles de phase qui sont
// définies en running.
//
// Réalisé : agrégé côté serveur via /api/activities/week-totals (running
// uniquement = Run + TrailRun, même règle d'overrides manual_* que le bloc
// Objectifs du Cockpit — lib/data/dashboard.buildSportOverview).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  getCurrentPlan,
  getPlannedSessions,
  peekMacros,
  peekSessions,
  pickActiveMacrocycle,
} from '@/lib/plan/storage'
import type { Phase, PlannedSession, TrainingPlan } from '@/types/plan'
import { resolveWeeklyTarget } from '@/lib/training/phases'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { colors } from '@/lib/design/colors'
import { BlockCard } from '@/components/blocks/BlockCard'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

// ─── Helpers date (semaine ISO, lundi → dimanche, UTC) ───────────────────────
function toISO(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfISOWeek(d: Date): Date {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = utc.getUTCDay() || 7
  if (dow !== 1) utc.setUTCDate(utc.getUTCDate() - (dow - 1))
  return utc
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d.getTime())
  next.setUTCDate(next.getUTCDate() + n)
  return next
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function formatDM(iso: string): string {
  const d = parseISO(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function isoWeek(d: Date): number {
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = u.getUTCDay() || 7
  u.setUTCDate(u.getUTCDate() + 4 - day)
  const y = new Date(Date.UTC(u.getUTCFullYear(), 0, 1))
  return Math.ceil(((u.getTime() - y.getTime()) / 86_400_000 + 1) / 7)
}

function formatDow(iso: string, dow: readonly string[]): string {
  return dow[parseISO(iso).getUTCDay()]
}

function formatLong(iso: string, months: readonly string[]): string {
  const d = parseISO(iso)
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`
}

function fmt1(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1)
}

function findCurrentPhase(plan: TrainingPlan | null, anchorISO: string): Phase | null {
  if (!plan) return null
  return plan.phases.find(p => p.startDate <= anchorISO && anchorISO <= p.endDate) ?? null
}

// ─── Cache LS pour /api/activities/week-totals (par semaine) ─────────────────
// Le fetch HTTP vers cet endpoint n'est pas dans les caches storage Supabase.
// Sans persistance, les tuiles « Réalisé » et « Restant » (dérivé) flashent à
// 0 à chaque mount avant que la requête HTTP résolve. Même pattern SWR que
// les autres snapshots : init synchrone depuis LS, revalide en background.
type WeekTotals = { km: number; dPlus: number; load: number }
const WEEK_TOTALS_TTL_MS = 5 * 60_000
const KEY_WEEK_TOTALS = 'tc:plan:cache:week_totals:v1'

function readWeekTotalsCache(): Record<string, { data: WeekTotals; savedAt: number }> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY_WEEK_TOTALS)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function peekWeekTotals(weekStartISO: string): WeekTotals | null {
  const all = readWeekTotalsCache()
  const hit = all[weekStartISO]
  if (!hit) return null
  if (Date.now() - hit.savedAt > WEEK_TOTALS_TTL_MS) return null
  return hit.data
}

function persistWeekTotals(weekStartISO: string, data: WeekTotals): void {
  if (typeof window === 'undefined') return
  try {
    const all = readWeekTotalsCache()
    all[weekStartISO] = { data, savedAt: Date.now() }
    window.localStorage.setItem(KEY_WEEK_TOTALS, JSON.stringify(all))
  } catch { /* quota / mode privé */ }
}

// ─── Tile explanations ───────────────────────────────────────────────────────
type TileKey = 'objectif' | 'planifie' | 'realise' | 'restant'
function getTileExpl(L: Dict['plan']): Record<TileKey, ReactNode> {
  return {
    objectif: <>{L.tileObjectifExpl}</>,
    planifie: <>{L.tilePlanifieExpl}</>,
    realise:  <>{L.tileRealiseExpl}</>,
    restant:  <>{L.tileRestantExpl}</>,
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────
type ResumeSemaineBlockProps = {
  /**
   * Compteur incrémenté par le parent (PlanClient) après une opération DnD
   * ou un save. Inclus dans les deps du reload pour forcer un re-fetch sans
   * démonter le composant.
   */
  reloadKey?: number
  /**
   * Mode Mission : masque les tuiles « Planifié » et « Restant » (aspect
   * planification) → ne reste qu'Objectif + Réalisé + les barres de progression.
   */
  simplified?: boolean
}

// ─── Composant principal ─────────────────────────────────────────────────────
export function ResumeSemaineBlock({ reloadKey = 0, simplified = false }: ResumeSemaineBlockProps = {}) {
  const L = useT().plan
  const TILE_EXPLANATIONS = useMemo(() => getTileExpl(L), [L])
  const todayISO = useMemo(() => {
    const n = new Date()
    return toISO(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())))
  }, [])
  const [selectedDateISO, setSelectedDateISO] = useState<string>(todayISO)

  // Catalogue de types (builtin + custom user) pour résoudre la catégorie
  // running de chaque séance — y compris les types custom catégorisés 'run'.
  const { types } = useActivityTypes()

  // Bornes de la semaine sélectionnée.
  const weekStartISO = useMemo(
    () => toISO(startOfISOWeek(parseISO(selectedDateISO))),
    [selectedDateISO],
  )
  const weekEndISO = useMemo(
    () => toISO(addDays(parseISO(weekStartISO), 6)),
    [weekStartISO],
  )

  // Lazy-init depuis le snapshot LS (visite précédente) — supprime le flash.
  // Le plan se dérive du snapshot via pickActiveMacrocycle pour rester cohérent
  // avec ce que retourne getCurrentPlan().
  const initialMacros = peekMacros()
  const initialSessions = peekSessions(weekStartISO, weekEndISO)
  const [plan, setPlan] = useState<TrainingPlan | null>(
    initialMacros ? pickActiveMacrocycle(initialMacros, weekStartISO) : null,
  )
  const [sessions, setSessions] = useState<PlannedSession[]>(initialSessions ?? [])
  const [loaded, setLoaded] = useState(initialSessions !== null && initialMacros !== null)

  // Reload avec garde anti-race.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [s, p] = await Promise.all([
        getPlannedSessions(weekStartISO, weekEndISO),
        getCurrentPlan(),
      ])
      if (cancelled) return
      setSessions(s)
      setPlan(p)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [weekStartISO, weekEndISO, reloadKey])

  const currentPhase = useMemo(
    () => findCurrentPhase(plan, weekStartISO),
    [plan, weekStartISO],
  )

  // Séances running uniquement (vélo/natation/renfo/muscu exclus) avec un
  // title non vide — base pour le compteur et les totaux. Le resolver gère
  // les types builtin ET les types custom catégorisés 'run'.
  const runningSessions = useMemo(
    () => sessions.filter(s => s.title && resolveSessionMeta(s.type, types).isRunning),
    [sessions, types],
  )

  const plannedSessionsCount = runningSessions.length

  // Sommes prévues (km, D+, charge) sur la semaine — running uniquement.
  const planned = useMemo(() => {
    let km = 0
    let dPlus = 0
    let load = 0
    for (const s of runningSessions) {
      km += s.distance ?? 0
      dPlus += s.elevation ?? 0
      load += s.estimatedCharge ?? 0
    }
    return { km, dPlus, load }
  }, [runningSessions])

  // Cibles (phase courante). km / D+ utilisent l'override hebdo si présent
  // pour la semaine en cours (sinon cibles uniformes de la phase). Charge
  // reste pilotée au niveau phase (pas d'override hebdo demandé pour TSS).
  const targets = useMemo(() => {
    if (!currentPhase) return { km: 0, dPlus: 0, load: 0 }
    const { km, dPlus } = resolveWeeklyTarget(currentPhase, weekStartISO)
    return { km, dPlus, load: currentPhase.weeklyChargeTarget ?? 0 }
  }, [currentPhase, weekStartISO])

  // Réalisé (running uniquement) : fetché depuis /api/activities/week-totals
  // sur le range [lundi, lundi+7[. Re-fetch quand on change de semaine ou
  // après une opération qui peut altérer les activités (reloadKey).
  // Lazy-init depuis le cache LS pour rendre synchronement les tuiles
  // « Réalisé » et « Restant » (dérivé d'`actual`) — pas de flash à 0.
  const [actual, setActual] = useState<WeekTotals>(
    () => peekWeekTotals(weekStartISO) ?? { km: 0, dPlus: 0, load: 0 },
  )
  useEffect(() => {
    let cancelled = false
    // Si on change de semaine, repartir du cache de cette nouvelle semaine
    // pour éviter d'afficher les totaux de la précédente le temps du fetch.
    const cached = peekWeekTotals(weekStartISO)
    if (cached) setActual(cached)
    const toExclusiveISO = toISO(addDays(parseISO(weekStartISO), 7))
    void (async () => {
      try {
        const res = await fetch(
          `/api/activities/week-totals?from=${weekStartISO}&to=${toExclusiveISO}&category=run`,
          { cache: 'no-store' },
        )
        if (!res.ok) return
        const data = await res.json() as { km: number; dPlus: number; ces: number }
        if (cancelled) return
        const totals: WeekTotals = { km: data.km ?? 0, dPlus: data.dPlus ?? 0, load: data.ces ?? 0 }
        setActual(totals)
        persistWeekTotals(weekStartISO, totals)
      } catch {
        if (!cancelled) setActual({ km: 0, dPlus: 0, load: 0 })
      }
    })()
    return () => { cancelled = true }
  }, [weekStartISO, reloadKey])

  // Restant = ce qu'il reste pour atteindre l'OBJECTIF de la phase (pas le
  // planifié). Si déjà dépassé (actual > targets), restant = 0 (pas de négatif).
  const remaining = useMemo(() => ({
    km:    Math.max(0, targets.km    - actual.km),
    dPlus: Math.max(0, targets.dPlus - actual.dPlus),
    load:  Math.max(0, targets.load  - actual.load),
  }), [targets, actual])

  const weekNumber = useMemo(() => isoWeek(parseISO(weekStartISO)), [weekStartISO])

  // ─── Navigation ─────────────────────────────────────────────────────────────
  // Le `<` / `>` change la semaine ET garde le même offset (jour) à l'intérieur.
  const offsetInWeek = useMemo(() => {
    const startTs = parseISO(weekStartISO).getTime()
    const selTs = parseISO(selectedDateISO).getTime()
    return Math.round((selTs - startTs) / 86_400_000)
  }, [weekStartISO, selectedDateISO])

  const gotoOffsetWeeks = useCallback((offset: number) => {
    const newStart = addDays(parseISO(weekStartISO), offset * 7)
    const newSelected = toISO(addDays(newStart, offsetInWeek))
    setSelectedDateISO(newSelected)
  }, [weekStartISO, offsetInWeek])

  const gotoToday = useCallback(() => {
    setSelectedDateISO(todayISO)
  }, [todayISO])

  // ─── Popover par mini-tuile ─────────────────────────────────────────────────
  // Une seule tuile ouverte à la fois. Fermeture au clic extérieur ou Escape.
  const [openTile, setOpenTile] = useState<TileKey | null>(null)
  const tilesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openTile) return
    function handlePointer(e: MouseEvent | TouchEvent) {
      if (
        tilesContainerRef.current &&
        !tilesContainerRef.current.contains(e.target as Node)
      ) {
        setOpenTile(null)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenTile(null)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openTile])

  const toggleTile = useCallback((key: TileKey) => {
    setOpenTile(prev => (prev === key ? null : key))
  }, [])

  return (
    <BlockCard
      title={L.resumeTitle}
      helpTitle={L.resumeTitle}
      helpBody={L.resumeHelp}
    >
      <p className="text-[12px] text-trail-muted">
        {L.weekRange(weekNumber, formatDM(weekStartISO), formatDM(weekEndISO))}
      </p>

      <div className="flex items-center gap-2 mt-3">
        <NavButton
          label="<"
          ariaLabel={L.weekPrev}
          onClick={() => gotoOffsetWeeks(-1)}
        />
        <div
          className="flex-1 rounded-[10px] flex flex-col items-center py-2"
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
        >
          <span className="text-[11px] text-trail-muted">{formatDow(selectedDateISO, L.dowLong)}</span>
          <span
            className="text-[18px] text-trail-text leading-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
          >
            {formatLong(selectedDateISO, L.monthsShort)}
          </span>
        </div>
        <NavButton
          label=">"
          ariaLabel={L.weekNext}
          onClick={() => gotoOffsetWeeks(1)}
        />
        <button
          type="button"
          onClick={gotoToday}
          style={{ color: colors.chargeOrange }}
          className="flex-shrink-0 text-[12px] font-semibold bg-transparent border-none cursor-pointer px-1"
          aria-label={L.todayAria}
        >
          {L.today}
        </button>
      </div>

      {/* ── 4 tuiles métriques + popover pleine largeur ─────────────────── */}
      <div ref={tilesContainerRef} className="mt-[14px]">
        <div className="flex gap-2">
          <MetricTile
            tileKey="objectif"
            label={L.tileObjectif}
            main={`${fmt1(targets.km)} km`}
            sub={`${Math.round(targets.dPlus)} ${L.mDPlus}`}
            color={colors.chargeOrange}
            open={openTile === 'objectif'}
            onToggle={toggleTile}
          />
          {!simplified && plannedSessionsCount > 0 && (
            <MetricTile
              tileKey="planifie"
              label={L.tilePlanifie}
              main={`${fmt1(planned.km)} km`}
              sub={`${Math.round(planned.dPlus)} ${L.mDPlus}`}
              color={colors.seriesBlue}
              open={openTile === 'planifie'}
              onToggle={toggleTile}
            />
          )}
          <MetricTile
            tileKey="realise"
            label={L.tileRealise}
            main={`${fmt1(actual.km)} km`}
            sub={`${Math.round(actual.dPlus)} ${L.mDPlus}`}
            color={colors.greenOk}
            open={openTile === 'realise'}
            onToggle={toggleTile}
          />
          {!simplified && (
            <MetricTile
              tileKey="restant"
              label={L.tileRestant}
              main={`${fmt1(remaining.km)} km`}
              sub={`${Math.round(remaining.dPlus)} ${L.mDPlus}`}
              color={colors.seriesYellow}
              open={openTile === 'restant'}
              onToggle={toggleTile}
            />
          )}
        </div>
        {openTile && (
          <TilePopover
            tileKey={openTile}
            explanation={TILE_EXPLANATIONS[openTile]}
            color={
              openTile === 'objectif' ? colors.chargeOrange
              : openTile === 'planifie' ? colors.seriesBlue
              : openTile === 'realise'  ? colors.greenOk
              :                            colors.seriesYellow
            }
            label={
              openTile === 'objectif' ? L.tileObjectif
              : openTile === 'planifie' ? L.tilePlanifie
              : openTile === 'realise'  ? L.tileRealise
              :                            L.tileRestant
            }
          />
        )}
      </div>

      {/* ── 3 progress bars : Réalisé vs Objectif ───────────────────────── */}
      <div className="mt-3 space-y-2">
        <ProgressLine
          label={L.progressVolume}
          current={actual.km}
          target={targets.km}
          unit="km"
          color={colors.chargeOrange}
        />
        <ProgressLine
          label={L.progressElevation}
          current={actual.dPlus}
          target={targets.dPlus}
          unit="m"
          color={colors.seriesBlue}
        />
      </div>

      {!loaded && (
        <div className="text-center text-trail-muted text-[12px] mt-2" role="status">{L.loading}</div>
      )}
    </BlockCard>
  )
}

// ─── Sous-composants ─────────────────────────────────────────────────────────
function NavButton({
  label, ariaLabel, onClick,
}: { label: string; ariaLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: 10,
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        fontSize: 18,
        fontWeight: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function MetricTile({
  tileKey, label, main, sub, color, open, onToggle,
}: {
  tileKey: TileKey
  label: string
  main: string
  sub: string
  color: string
  open: boolean
  onToggle: (key: TileKey) => void
}) {
  const L = useT().plan
  const firstSpace = main.indexOf(' ')
  const mainValue = firstSpace > 0 ? main.slice(0, firstSpace) : main
  const mainUnit  = firstSpace > 0 ? main.slice(firstSpace + 1) : ''
  return (
    <button
      type="button"
      onClick={() => onToggle(tileKey)}
      aria-expanded={open}
      aria-label={L.explanationAria(label)}
      className="flex-1 min-w-0 text-left rounded-[10px] px-[6px] py-[8px] cursor-pointer"
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${open ? color : colors.border}`,
      }}
    >
      <p className="text-[11px] text-trail-muted">{label}</p>
      <p className="mt-[2px] flex items-baseline gap-[2px] min-w-0">
        <span className="text-[18px] font-bold leading-none truncate" style={{ color }}>{mainValue}</span>
        {mainUnit && (
          <span className="text-[11px] text-trail-muted leading-none flex-shrink-0">{mainUnit}</span>
        )}
      </p>
      <p className="text-[11px] text-trail-muted mt-[2px] truncate">{sub}</p>
    </button>
  )
}

function TilePopover({
  color, label, explanation,
}: { tileKey: TileKey; color: string; label: string; explanation: ReactNode }) {
  return (
    <div
      role="tooltip"
      className="mt-[6px] rounded-[10px] p-[10px]"
      style={{
        backgroundColor: colors.cardBg,
        border: `1px solid ${color}`,
      }}
    >
      <p className="text-[12px] font-semibold mb-[4px]" style={{ color }}>
        {label}
      </p>
      <p className="text-[12px] text-trail-muted leading-[17px]">
        {explanation}
      </p>
    </div>
  )
}

function ProgressLine({
  label, current, target, unit, color,
}: { label: string; current: number; target: number; unit: string; color: string }) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0
  return (
    <div>
      <div className="flex justify-between mb-[6px]">
        <span className="text-[12px] text-trail-muted">{label}</span>
        <span className="text-[12px] font-semibold text-trail-text">
          {fmt1(current)} / {fmt1(target)} {unit}
        </span>
      </div>
      <div
        className="h-[8px] rounded-full overflow-hidden"
        style={{ backgroundColor: `${color}26` }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
