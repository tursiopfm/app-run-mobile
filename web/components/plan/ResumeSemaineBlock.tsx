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
// MVP : pas de notion de "réalisé" (pas de sync Activity ↔ PlannedSession encore).
// → actualKm / actualDPlus / actualLoad sont à 0 pour l'instant (TODO).

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getCurrentPlan,
  getMainRace,
  getPlannedSessions,
} from '@/lib/plan/storage'
import type { Phase, PlannedSession, Race, TrainingPlan } from '@/types/plan'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { colors } from '@/lib/design/colors'
import { BlockCard } from '@/components/blocks/BlockCard'

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

const DOW_LABELS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTHS_FR_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function formatDowFR(iso: string): string {
  return DOW_LABELS_FR[parseISO(iso).getUTCDay()]
}

function formatLongFR(iso: string): string {
  const d = parseISO(iso)
  return `${d.getUTCDate()} ${MONTHS_FR_SHORT[d.getUTCMonth()]}`
}

function fmt1(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1)
}

function findCurrentPhase(plan: TrainingPlan | null, anchorISO: string): Phase | null {
  if (!plan) return null
  return plan.phases.find(p => p.startDate <= anchorISO && anchorISO <= p.endDate) ?? null
}

// ─── Props ───────────────────────────────────────────────────────────────────
type ResumeSemaineBlockProps = {
  /**
   * Compteur incrémenté par le parent (PlanClient) après une opération DnD
   * ou un save. Inclus dans les deps du reload pour forcer un re-fetch sans
   * démonter le composant.
   */
  reloadKey?: number
}

// ─── Composant principal ─────────────────────────────────────────────────────
export function ResumeSemaineBlock({ reloadKey = 0 }: ResumeSemaineBlockProps = {}) {
  // Date du jour sélectionné (par défaut : aujourd'hui en UTC).
  const todayISO = useMemo(() => {
    const n = new Date()
    return toISO(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())))
  }, [])
  const [selectedDateISO, setSelectedDateISO] = useState<string>(todayISO)

  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [mainRace, setMainRace] = useState<Race | null>(null)
  const [sessions, setSessions] = useState<PlannedSession[]>([])
  const [loaded, setLoaded] = useState(false)

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

  // Reload avec garde anti-race.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [s, p, r] = await Promise.all([
        getPlannedSessions(weekStartISO, weekEndISO),
        getCurrentPlan(),
        getMainRace(),
      ])
      if (cancelled) return
      setSessions(s)
      setPlan(p)
      setMainRace(r)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [weekStartISO, weekEndISO, reloadKey])

  const currentPhase = useMemo(
    () => findCurrentPhase(plan, weekStartISO),
    [plan, weekStartISO],
  )

  // Label objectif : phase courante si dispo, sinon course principale, sinon "—".
  const objectiveLabel = useMemo(() => {
    if (currentPhase) return currentPhase.label
    if (mainRace) return mainRace.name
    return '—'
  }, [currentPhase, mainRace])

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

  // Cibles (phase courante). Si pas de phase : 0.
  const targets = useMemo(() => ({
    km:    currentPhase?.weeklyDistanceKmTarget  ?? 0,
    dPlus: currentPhase?.weeklyElevationMTarget   ?? 0,
    load:  currentPhase?.weeklyChargeTarget       ?? 0,
  }), [currentPhase])

  // TODO : remplacer par vraies données quand sync Activity ↔ PlannedSession.
  const actualKm = 0
  const actualDPlus = 0
  const actualLoad = 0

  // Restant = ce qui reste à exécuter de la planif. Si on a déjà dépassé la
  // planif (actual > planned), restant = 0 (pas de valeur négative).
  const remaining = useMemo(() => ({
    km:    Math.max(0, planned.km    - actualKm),
    dPlus: Math.max(0, planned.dPlus - actualDPlus),
    load:  Math.max(0, planned.load  - actualLoad),
  }), [planned])

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

  return (
    <BlockCard
      title="Résumé semaine"
      helpTitle="Résumé semaine"
      helpBody="Comparaison objectif vs prévu vs restant sur la semaine sélectionnée."
      rightSlot={
        <span
          className="ml-2 flex-shrink-0 rounded-full px-2 py-[3px] text-[11px] font-bold whitespace-nowrap"
          style={{
            backgroundColor: `${colors.chargeOrange}26`,
            color: colors.chargeOrange,
            border: `1px solid ${colors.chargeOrange}4D`,
          }}
        >
          {plannedSessionsCount} séances
        </span>
      }
    >
      <p className="text-[12px] text-trail-muted">
        S{weekNumber} — {formatDM(weekStartISO)} au {formatDM(weekEndISO)} — {objectiveLabel}
      </p>

      {/* ── Nav row : < jour > Aujourd'hui ──────────────────────────────── */}
      <div className="flex items-center gap-2 mt-3">
        <NavButton
          label="<"
          ariaLabel="Semaine précédente"
          onClick={() => gotoOffsetWeeks(-1)}
        />
        <div
          className="flex-1 rounded-[10px] flex flex-col items-center py-2"
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
        >
          <span className="text-[11px] text-trail-muted">{formatDowFR(selectedDateISO)}</span>
          <span
            className="text-[18px] text-trail-text leading-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
          >
            {formatLongFR(selectedDateISO)}
          </span>
        </div>
        <NavButton
          label=">"
          ariaLabel="Semaine suivante"
          onClick={() => gotoOffsetWeeks(1)}
        />
        <button
          type="button"
          onClick={gotoToday}
          style={{ color: colors.chargeOrange }}
          className="flex-shrink-0 text-[12px] font-semibold bg-transparent border-none cursor-pointer px-1"
          aria-label="Revenir à aujourd'hui"
        >
          Aujourd&apos;hui
        </button>
      </div>

      {/* ── 4 tuiles métriques : Objectif / Planifié / Réalisé / Restant ── */}
      <div className="flex gap-2 mt-[14px]">
        <MetricTile
          label="Objectif"
          main={`${fmt1(targets.km)} km`}
          sub={`${Math.round(targets.dPlus)} m D+`}
          color={colors.chargeOrange}
        />
        <MetricTile
          label="Planifié"
          main={`${fmt1(planned.km)} km`}
          sub={`${plannedSessionsCount} séances`}
          color={colors.seriesBlue}
        />
        <MetricTile
          label="Réalisé"
          main={`${fmt1(actualKm)} km`}
          sub={`${Math.round(actualDPlus)} m D+`}
          color={colors.greenOk}
        />
        <MetricTile
          label="Restant"
          main={`${fmt1(remaining.km)} km`}
          sub={`${Math.round(remaining.dPlus)} m D+`}
          color={colors.seriesYellow}
        />
      </div>

      {/* ── 3 progress bars : Réalisé vs Objectif ───────────────────────── */}
      <div className="mt-3 space-y-2">
        <ProgressLine
          label="Volume semaine"
          current={actualKm}
          target={targets.km}
          unit="km"
          color={colors.chargeOrange}
        />
        <ProgressLine
          label="Dénivelé"
          current={actualDPlus}
          target={targets.dPlus}
          unit="m"
          color={colors.seriesBlue}
        />
        <ProgressLine
          label="Charge"
          current={actualLoad}
          target={targets.load}
          unit="pts"
          color={colors.seriesYellow}
        />
      </div>

      {!loaded && (
        <div className="text-center text-trail-muted text-[12px] mt-2" role="status">Chargement…</div>
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
  label, main, sub, color,
}: { label: string; main: string; sub: string; color: string }) {
  return (
    <div
      className="flex-1 min-w-0 rounded-[10px] px-[10px] py-[8px]"
      style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
    >
      <p className="text-[11px] text-trail-muted">{label}</p>
      <p className="text-[18px] font-bold mt-[2px] truncate" style={{ color }}>{main}</p>
      <p className="text-[11px] text-trail-muted mt-[1px] truncate">{sub}</p>
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
