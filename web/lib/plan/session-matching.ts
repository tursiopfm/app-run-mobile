// Matching automatique séance planifiée ↔ activité(s) réalisée(s) pour le bloc
// Vue Semaine. Affichage seulement (pas de persistance Supabase) : si l'user
// "délie" une paire, on la stocke en LS pour ne plus la proposer.
//
// Règles de matching :
//   1. Même jour ISO (start_time de l'activité tronqué à YYYY-MM-DD)
//   2. Même catégorie sportive (run/bike/swim/other) entre PlannedSession.type
//      et activity.sport_type (effectif = manual_sport_type ?? sport_type)
//   3. Si la séance a une distance cible : tolérance ±25 % (plancher 2 km)
//   4. Si la séance a un D+ cible : tolérance ±40 % (plancher 50 m)
//   5. Si la séance n'a pas de distance/D+ : on accepte n'importe quelle
//      activité du même jour + même catégorie
//   6. Cumul aller+retour pour runtaf / velotaf : on tente aussi des paires de
//      2 activités du même jour (somme distance + somme D+ comparées à la cible)
//   7. Score = somme des écarts relatifs distance + D+ ; affectation greedy 1:N
//      par score croissant (1 séance → 1 OU 2 activités, jamais plus)

import type { PlannedSession } from '@/types/plan'
import type { ActivityType } from '@/types/activity-types'
import { resolveSessionMeta, type SessionCategory } from './session-meta'

export type MatchableActivity = {
  id: string
  date: string                 // ISO YYYY-MM-DD (start_time tronqué)
  sportType: string            // 'Run' / 'TrailRun' / 'Ride' / 'Swim' / etc.
  distanceKm: number           // effective = manual_distance_m ?? distance_m
  elevationM: number           // effective = manual_elevation_gain_m ?? elevation_gain_m
  name?: string
}

const RUN_TYPES = new Set(['Run', 'TrailRun'])
const BIKE_TYPES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'EBikeRide', 'MountainBikeRide'])
const SWIM_TYPES = new Set(['Swim'])

export function activityCategory(sport: string): SessionCategory {
  if (RUN_TYPES.has(sport)) return 'run'
  if (BIKE_TYPES.has(sport)) return 'bike'
  if (SWIM_TYPES.has(sport)) return 'swim'
  return 'other'
}

const DIST_TOL_REL = 0.25
const DIST_TOL_MIN_KM = 2
const ELEV_TOL_REL = 0.40
const ELEV_TOL_MIN_M = 50

// Types de séance dont la cible est l'aller+retour cumulé sur la journée.
// On essaie aussi des paires d'activités du même jour pour ces séances-là.
const CUMULATIVE_TYPES = new Set<string>(['runtaf', 'velotaf'])

// Léger malus sur les candidats à 2 activités pour qu'à score égal, le single
// gagne (une seule activité couvrant le cumul est plus probable qu'un cumul
// fortuit, et c'est aussi moins ambigu côté UX).
const PAIR_PENALTY = 0.001

function scorePair(
  sessionDistance: number | undefined,
  sessionElevation: number | undefined,
  actDistance: number,
  actElevation: number,
): { ok: boolean; score: number } {
  if (sessionDistance && sessionDistance > 0) {
    const tol = Math.max(sessionDistance * DIST_TOL_REL, DIST_TOL_MIN_KM)
    if (Math.abs(actDistance - sessionDistance) > tol) return { ok: false, score: Infinity }
  }
  if (sessionElevation && sessionElevation > 0) {
    const tol = Math.max(sessionElevation * ELEV_TOL_REL, ELEV_TOL_MIN_M)
    if (Math.abs(actElevation - sessionElevation) > tol) return { ok: false, score: Infinity }
  }
  const distScore = sessionDistance && sessionDistance > 0
    ? Math.abs(actDistance - sessionDistance) / Math.max(sessionDistance, 1)
    : 0
  const elevScore = sessionElevation && sessionElevation > 0
    ? Math.abs(actElevation - sessionElevation) / Math.max(sessionElevation, 1)
    : 0
  return { ok: true, score: distScore + elevScore }
}

/**
 * Calcule le mapping sessionId → liste d'activityIds pour la semaine.
 * 1 ou 2 activités par séance (2 uniquement pour runtaf/velotaf en mode cumul).
 * @param sessions séances planifiées de la fenêtre
 * @param activities activités réalisées de la fenêtre
 * @param typesCatalog catalogue activity_types (pour résoudre la catégorie d'un slug custom)
 * @param rejectedPairs paires explicitement déliées par l'user (clé "sessionId|activityId")
 */
export function matchSessionsToActivities(
  sessions: PlannedSession[],
  activities: MatchableActivity[],
  typesCatalog: ActivityType[],
  rejectedPairs?: Set<string>,
): Map<string, string[]> {
  const byDate = new Map<string, MatchableActivity[]>()
  for (const a of activities) {
    const list = byDate.get(a.date) ?? []
    list.push(a)
    byDate.set(a.date, list)
  }

  type Candidate = { sessionId: string; activityIds: string[]; score: number }
  const candidates: Candidate[] = []

  for (const s of sessions) {
    const acts = byDate.get(s.date)
    if (!acts || acts.length === 0) continue
    const meta = resolveSessionMeta(s.type, typesCatalog)
    const sameCat = acts.filter(a => activityCategory(a.sportType) === meta.category)
    if (sameCat.length === 0) continue
    const isCumulative = CUMULATIVE_TYPES.has(s.type)

    // Candidats à 1 activité.
    for (const a of sameCat) {
      if (rejectedPairs?.has(`${s.id}|${a.id}`)) continue
      const r = scorePair(s.distance, s.elevation, a.distanceKm, a.elevationM)
      if (!r.ok) continue
      candidates.push({ sessionId: s.id, activityIds: [a.id], score: r.score })
    }

    // Candidats à 2 activités cumulées (aller + retour) — uniquement runtaf/velotaf.
    if (isCumulative) {
      for (let i = 0; i < sameCat.length; i++) {
        for (let j = i + 1; j < sameCat.length; j++) {
          const a1 = sameCat[i]
          const a2 = sameCat[j]
          if (rejectedPairs?.has(`${s.id}|${a1.id}`)) continue
          if (rejectedPairs?.has(`${s.id}|${a2.id}`)) continue
          const r = scorePair(
            s.distance,
            s.elevation,
            a1.distanceKm + a2.distanceKm,
            a1.elevationM + a2.elevationM,
          )
          if (!r.ok) continue
          candidates.push({ sessionId: s.id, activityIds: [a1.id, a2.id], score: r.score + PAIR_PENALTY })
        }
      }
    }
  }

  // Greedy 1:N par meilleur score. Une activité ne peut servir qu'à une séance.
  candidates.sort((a, b) => a.score - b.score)
  const result = new Map<string, string[]>()
  const usedActivities = new Set<string>()
  const usedSessions = new Set<string>()
  for (const c of candidates) {
    if (usedSessions.has(c.sessionId)) continue
    if (c.activityIds.some(id => usedActivities.has(id))) continue
    result.set(c.sessionId, c.activityIds)
    usedSessions.add(c.sessionId)
    for (const id of c.activityIds) usedActivities.add(id)
  }
  return result
}

// ─── LS : paires déliées par l'user ─────────────────────────────────────────
const KEY_UNLINKED = 'tc:plan:unlinked:v1'

export function getUnlinkedPairs(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(KEY_UNLINKED)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function addUnlinkedPair(sessionId: string, activityId: string): void {
  if (typeof window === 'undefined') return
  const set = getUnlinkedPairs()
  set.add(`${sessionId}|${activityId}`)
  try {
    window.localStorage.setItem(KEY_UNLINKED, JSON.stringify(Array.from(set)))
  } catch {
    // quota / mode privé : ignore.
  }
}
