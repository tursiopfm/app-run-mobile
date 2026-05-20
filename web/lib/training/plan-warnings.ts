// Moteur pur de calcul des warnings pédagogiques sur un plan d'entraînement.
// Aucune dépendance React/Supabase, testable en isolation.

import type { MesocycleWeek, Phase, Race, TrainingPlan } from '@/types/plan'

export type WarningSeverity = 'info' | 'warning' | 'critical'

export type WarningKind =
  | 'race_a_orphan'
  | 'taper_missing'
  | 'sharp_ramp'
  | 'phase_gap'
  | 'phase_overlap'

export interface PlanWarning {
  id: string
  kind: WarningKind
  severity: WarningSeverity
  title: string
  detail: string
  phaseId?: string
  raceId?: string
  weekIndex?: number
}

export interface WarningInput {
  macros: TrainingPlan[]
  activeMacrocycle: TrainingPlan | null
  races: Race[]
  weeksByPhase: Record<string, MesocycleWeek[]>
}

const SHARP_RAMP_VOLUME_RATIO = 1.20
const SHARP_RAMP_LOAD_RATIO = 1.20
const SHARP_RAMP_DPLUS_RATIO = 1.30
const TAPER_LOOKBACK_DAYS = 14

const MS_PER_DAY = 86_400_000

function parseISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1)
}

function toISO(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function addDaysISO(iso: string, days: number): string {
  return toISO(parseISO(iso) + days * MS_PER_DAY)
}

function daysBetween(aISO: string, bISO: string): number {
  return Math.round((parseISO(bISO) - parseISO(aISO)) / MS_PER_DAY)
}

const SEVERITY_RANK: Record<WarningSeverity, number> = { critical: 0, warning: 1, info: 2 }
const KIND_RANK: Record<WarningKind, number> = {
  race_a_orphan: 0,
  taper_missing: 1,
  phase_overlap: 2,
  phase_gap: 3,
  sharp_ramp: 4,
}

export function computeWarnings(input: WarningInput): PlanWarning[] {
  const out: PlanWarning[] = []

  // 1. race_a_orphan
  for (const race of input.races) {
    if (race.priority !== 'A') continue
    const covered = input.macros.some(m => m.startDate <= race.date && race.date <= m.endDate)
    if (!covered) {
      out.push({
        id: `race_a_orphan:${race.id}`,
        kind: 'race_a_orphan',
        severity: 'critical',
        title: `Course ${race.name} (priorité A) hors macrocycle`,
        detail: `Aucun macrocycle ne couvre la date ${race.date}. Crée ou étend un macrocycle pour préparer cette course.`,
        raceId: race.id,
      })
    }
  }

  // 2. taper_missing (sur le macro actif)
  if (input.activeMacrocycle) {
    const macro = input.activeMacrocycle
    const aRacesInMacro = input.races.filter(r =>
      r.priority === 'A' && macro.startDate <= r.date && r.date <= macro.endDate,
    )
    for (const race of aRacesInMacro) {
      const lookbackStart = addDaysISO(race.date, -TAPER_LOOKBACK_DAYS)
      const hasTaper = macro.phases.some(p =>
        p.type === 'affutage' && p.endDate >= lookbackStart && p.endDate <= race.date,
      )
      if (!hasTaper) {
        out.push({
          id: `taper_missing:${race.id}`,
          kind: 'taper_missing',
          severity: 'warning',
          title: `Course ${race.name} sans affûtage`,
          detail: `Aucune phase d'affûtage ne précède cette course (dans les ${TAPER_LOOKBACK_DAYS} jours). Ajoute-en une pour arriver frais.`,
          raceId: race.id,
        })
      }
    }
  }

  // 3. phase_gap + 4. phase_overlap (sur le macro actif)
  if (input.activeMacrocycle) {
    const phases = [...input.activeMacrocycle.phases].sort((a, b) => a.startDate.localeCompare(b.startDate))
    for (let i = 0; i < phases.length - 1; i++) {
      const a = phases[i], b = phases[i + 1]
      if (b.startDate > a.endDate) {
        out.push({
          id: `phase_gap:${a.id}:${b.id}`,
          kind: 'phase_gap',
          severity: 'info',
          title: `Trou entre ${a.label} et ${b.label}`,
          detail: `${a.endDate} → ${b.startDate} : ${daysBetween(a.endDate, b.startDate)} jours sans cycle. Ajuste les dates si non voulu.`,
          phaseId: a.id,
        })
      } else if (b.startDate < a.endDate) {
        out.push({
          id: `phase_overlap:${a.id}:${b.id}`,
          kind: 'phase_overlap',
          severity: 'warning',
          title: `Chevauchement ${a.label} ↔ ${b.label}`,
          detail: `Le cycle « ${b.label} » commence avant la fin de « ${a.label} ». Corrige les dates pour éviter les doubles séances.`,
          phaseId: a.id,
        })
      }
    }
  }

  // 5. sharp_ramp
  if (input.activeMacrocycle) {
    for (const phase of input.activeMacrocycle.phases) {
      const weeks = (input.weeksByPhase[phase.id] ?? []).slice().sort((a, b) => a.weekIndex - b.weekIndex)
      for (let i = 1; i < weeks.length; i++) {
        const prev = weeks[i - 1], curr = weeks[i]
        type Ratio = { value: number; threshold: number; label: string; from: number; to: number }
        const ratios: Ratio[] = [
          { label: 'volume', from: prev.targetVolumeKm, to: curr.targetVolumeKm, value: curr.targetVolumeKm / Math.max(prev.targetVolumeKm, 1), threshold: SHARP_RAMP_VOLUME_RATIO },
          { label: 'charge', from: prev.targetLoadTss,  to: curr.targetLoadTss,  value: curr.targetLoadTss  / Math.max(prev.targetLoadTss, 1),  threshold: SHARP_RAMP_LOAD_RATIO },
          { label: 'D+',     from: prev.targetDplusM,   to: curr.targetDplusM,   value: curr.targetDplusM   / Math.max(prev.targetDplusM, 1),   threshold: SHARP_RAMP_DPLUS_RATIO },
        ]
        for (const r of ratios) {
          if (r.value > r.threshold) {
            out.push({
              id: `sharp_ramp:${phase.id}:w${curr.weekIndex}:${r.label}`,
              kind: 'sharp_ramp',
              severity: 'info',
              title: `Montée brutale sem ${curr.weekIndex + 1} (${r.label})`,
              detail: `${r.label} passe de ${r.from} à ${r.to} (+${Math.round((r.value - 1) * 100)}%). Au-delà de ${Math.round((r.threshold - 1) * 100)}% le risque de surcharge augmente.`,
              phaseId: phase.id,
              weekIndex: curr.weekIndex,
            })
          }
        }
      }
    }
  }

  out.sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (sev !== 0) return sev
    return KIND_RANK[a.kind] - KIND_RANK[b.kind]
  })

  return out
}
