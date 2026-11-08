// Progression des cibles hebdo km / D+ d'un plan (étude :
// docs/superpowers/specs/2026-11-08-progression-plans-etude.md).
//   - Base = moyenne hebdo course à pied des 4 dernières semaines.
//   - Pic calibré sur l'objectif (distance, densité de D+).
//   - Cycle 3:1 : 3 semaines de charge croissante, 1 semaine de récup (−30 %).
//   - Affûtage : décroissance exponentielle depuis le pic (−35 % puis −55 %).
// Remplit `phase.weeklyTargets` (déjà persisté en JSONB, lu par resolveWeeklyTarget).

import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { Phase } from '@/types/plan'
import { phaseWeekCount } from './phases'

export type Baseline = { km: number; dPlus: number }
export type ProgressionGoal = { raceKm: number; raceDplus: number }

const RUN_TYPES = new Set(['Run', 'TrailRun'])
const KM_MAX_GROWTH = 1.10      // +10 %/sem de charge max
const DPLUS_MAX_GROWTH = 1.20   // +20 %/sem de charge max (D+ moins contraint)
const RECOVERY_FACTOR = 0.70    // semaine de récup du 3:1
const RECUP_PHASE_FACTOR = 0.60 // phase « Récupération » intermédiaire
const TAPER_FACTORS = [0.45, 0.65, 0.80] // depuis la semaine de course vers l'arrière

/** Moyenne hebdo km / D+ des activités course (lignes déjà limitées aux 28 derniers jours). */
export function computeBaseline(rows: ActivityRow[]): Baseline {
  let m = 0
  let dPlus = 0
  for (const a of rows) {
    if (!RUN_TYPES.has(a.manual_sport_type ?? a.sport_type)) continue
    m += a.manual_distance_m ?? a.distance_m ?? 0
    dPlus += a.manual_elevation_gain_m ?? a.elevation_gain_m ?? 0
  }
  return { km: m / 1000 / 4, dPlus: dPlus / 4 }
}

/** Pic hebdo visé : le ratio pic / distance course décroît avec la distance. */
export function peakTargets(goal: ProgressionGoal): Baseline {
  const km = Math.min(130, 40 + 0.45 * goal.raceKm)
  const density = goal.raceKm > 0 ? goal.raceDplus / goal.raceKm : 0
  const dPlus = Math.min(0.7 * goal.raceDplus, km * density)
  return { km, dPlus }
}

// Niveaux des semaines de charge : géométrique de start à peak, croissance plafonnée.
function loadingLevels(base: number, peak: number, count: number, maxGrowth: number): number[] {
  if (count <= 0) return []
  const start = base > 0 ? base * Math.min(1.07, maxGrowth) : peak * 0.6
  const target = Math.max(peak, start)
  const r = count > 1 ? Math.min(maxGrowth, Math.pow(target / start, 1 / (count - 1))) : 1
  return Array.from({ length: count }, (_, j) => start * Math.pow(r, j))
}

type WeekKind = 'load' | 'recovery' | 'recup_phase' | 'taper'

/**
 * Renvoie une copie des phases avec `weeklyTargets` rempli semaine par semaine
 * et les cibles uniformes de phase recalées sur la moyenne de ses semaines.
 */
export function applyProgression(phases: Phase[], base: Baseline, goal: ProgressionGoal): Phase[] {
  if (phases.length === 0) return phases

  // 1. Aplatir les semaines et leur attribuer un rôle.
  const weeks: Array<{ phaseIdx: number; kind: WeekKind }> = []
  let sinceRecovery = 0
  phases.forEach((p, phaseIdx) => {
    for (let i = 0; i < phaseWeekCount(p); i++) {
      if (p.type === 'affutage') {
        weeks.push({ phaseIdx, kind: 'taper' })
      } else if (p.type === 'recuperation') {
        weeks.push({ phaseIdx, kind: 'recup_phase' })
        sinceRecovery = 0
      } else if (sinceRecovery === 3) {
        weeks.push({ phaseIdx, kind: 'recovery' })
        sinceRecovery = 0
      } else {
        weeks.push({ phaseIdx, kind: 'load' })
        sinceRecovery++
      }
    }
  })
  // Pas de récup juste avant l'affûtage : la décharge suit de toute façon.
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].kind === 'taper') continue
    if (weeks[i].kind === 'recovery') weeks[i].kind = 'load'
    break
  }

  // 2. Niveaux des semaines de charge.
  const peak = goal.raceKm > 0 ? peakTargets(goal) : { km: base.km * 1.15, dPlus: base.dPlus * 1.15 }
  const loadCount = weeks.filter(w => w.kind === 'load').length
  const kmLevels = loadingLevels(base.km, peak.km, loadCount, KM_MAX_GROWTH)
  const dpLevels = loadingLevels(base.dPlus, peak.dPlus, loadCount, DPLUS_MAX_GROWTH)

  // 3. Valeurs semaine par semaine.
  const values: Array<{ km: number; dPlus: number }> = []
  let j = -1
  const level = (arr: number[], fallback: number) => (j >= 0 ? arr[j] : fallback)
  const startKm = base.km > 0 ? base.km : peak.km * 0.6
  const startDp = base.dPlus > 0 ? base.dPlus : peak.dPlus * 0.6
  const taperTotal = weeks.filter(w => w.kind === 'taper').length
  let taperIdx = 0
  for (const w of weeks) {
    if (w.kind === 'load') {
      j++
      values.push({ km: kmLevels[j], dPlus: dpLevels[j] })
    } else if (w.kind === 'recovery' || w.kind === 'recup_phase') {
      const f = w.kind === 'recovery' ? RECOVERY_FACTOR : RECUP_PHASE_FACTOR
      values.push({ km: level(kmLevels, startKm) * f, dPlus: level(dpLevels, startDp) * f })
    } else {
      const fromEnd = taperTotal - 1 - taperIdx++
      const f = TAPER_FACTORS[Math.min(fromEnd, TAPER_FACTORS.length - 1)]
      values.push({ km: level(kmLevels, startKm) * f, dPlus: level(dpLevels, startDp) * f })
    }
  }

  // 4. Réinjection dans les phases (km entier, D+ arrondi à 50 m).
  let cursor = 0
  return phases.map(p => {
    const count = phaseWeekCount(p)
    const weeklyTargets = values.slice(cursor, cursor + count).map(v => ({
      km: Math.round(v.km),
      dPlus: Math.round(v.dPlus / 50) * 50,
    }))
    cursor += count
    const avg = (f: (t: { km: number; dPlus: number }) => number) =>
      Math.round(weeklyTargets.reduce((s, t) => s + f(t), 0) / weeklyTargets.length)
    return {
      ...p,
      weeklyTargets,
      weeklyDistanceKmTarget: avg(t => t.km),
      weeklyElevationMTarget: avg(t => t.dPlus),
    }
  })
}
