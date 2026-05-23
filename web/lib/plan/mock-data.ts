// Données de dev pour l'onglet Plan.
// Garde-fou strict : ne JAMAIS seeder en prod. Activable via :
//   - process.env.NODE_ENV === 'development' (par défaut)
//   - OU process.env.NEXT_PUBLIC_PLAN_MOCK === '1' (force ON même hors dev)
// `seedMockDataIfEmpty()` ne touche au storage que si race / plan / sessions
// sont vides — pas de surcharge des données utilisateur réelles.

import type {
  PlannedSession,
  Race,
  SessionType,
  TrainingPlan,
} from '@/types/plan'
import {
  getCurrentPlan,
  getPlannedSessions,
  getRace,
  saveCurrentPlan,
  savePlannedSession,
  saveRace,
} from './storage'
import { autoDistributePhases } from '@/lib/training/phases'
import { estimateCharge } from '@/lib/training/charge'

// ─── Helpers date (UTC, ISO) ────────────────────────────────────────────────
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

// ─── Constantes mock ────────────────────────────────────────────────────────
const MOCK_RACE_ID = 'mock-race-templiers-2026'
const MOCK_PLAN_ID = 'mock-plan-templiers-2026'

export const MOCK_RACE: Race = {
  id: MOCK_RACE_ID,
  name: 'Trail des Templiers',
  date: '2026-10-25',
  distance: 70,
  elevation: 3500,
  type: 'trail',
  location: 'Millau',
  isMain: true,
  priority: 'A',
  notes: 'Mock dev : course objectif principale.',
}

// Plan auto-généré depuis aujourd'hui jusqu'à la date course.
// Utilise `autoDistributePhases` pour rester aligné avec la logique métier réelle.
function buildMockPlan(): TrainingPlan {
  const todayISO = toISO(new Date())
  const phases = autoDistributePhases(todayISO, MOCK_RACE.date)
  const nowISO = new Date().toISOString()
  return {
    id: MOCK_PLAN_ID,
    athleteId: '',
    name: 'Prépa Templiers 2026 (mock)',
    goalRaceId: MOCK_RACE_ID,
    startDate: todayISO,
    endDate: MOCK_RACE.date,
    phases,
    status: 'active',
    createdAt: nowISO,
    updatedAt: nowISO,
  }
}

export const MOCK_PLAN: TrainingPlan = buildMockPlan()

// ─── Sessions mock : 2 semaines (en cours + suivante) couvrant tous les types ─
type MockSessionSpec = {
  dayOffset: number   // 0 = lundi semaine en cours
  type: SessionType
  title: string
  duration: number
  intensity: 1 | 2 | 3 | 4 | 5
  distance?: number
  elevation?: number
}

const MOCK_SESSION_SPECS: MockSessionSpec[] = [
  // ── Semaine en cours ────────────────────────────────────────────────────
  { dayOffset: 0,  type: 'velotaf',      title: 'Velotaf récup',         duration: 60,  intensity: 2, distance: 20 },
  { dayOffset: 1,  type: 'fractionne',   title: '10×400m VMA',           duration: 65,  intensity: 5, distance: 9 },
  { dayOffset: 2,  type: 'runtaf',       title: 'Runtaf A/R',            duration: 60,  intensity: 2, distance: 10 },
  { dayOffset: 3,  type: 'seuil_tempo',  title: '2×20min Seuil',         duration: 75,  intensity: 4, distance: 13 },
  { dayOffset: 4,  type: 'cotes',        title: '6×2min côtes',          duration: 70,  intensity: 4, distance: 10, elevation: 350 },
  { dayOffset: 6,  type: 'sortie_longue', title: 'SL 2h progressive',    duration: 120, intensity: 2, distance: 20, elevation: 500 },
  // ── Semaine +1 ──────────────────────────────────────────────────────────
  { dayOffset: 7,  type: 'velotaf',      title: 'Velotaf 1h',            duration: 60,  intensity: 2, distance: 20 },
  { dayOffset: 8,  type: 'seuil_tempo',  title: '3×10min Seuil',         duration: 65,  intensity: 4, distance: 11 },
  { dayOffset: 10, type: 'cotes',        title: '10×30s côtes',          duration: 55,  intensity: 5, distance: 8,  elevation: 200 },
  { dayOffset: 11, type: 'fractionne',   title: '3×6min allure 5km',     duration: 65,  intensity: 5, distance: 10 },
  { dayOffset: 12, type: 'course',       title: 'Course de prépa',       duration: 90,  intensity: 4, distance: 15, elevation: 600 },
  { dayOffset: 13, type: 'sortie_longue', title: 'SL 3h spécifique',     duration: 180, intensity: 3, distance: 28, elevation: 900 },
]

function makeId(prefix: string, i: number): string {
  return `mock-${prefix}-${i}`
}

export const MOCK_PLANNED_SESSIONS: PlannedSession[] = (() => {
  const monday = startOfISOWeek(new Date())
  return MOCK_SESSION_SPECS.map((spec, i) => ({
    id: makeId('session', i),
    planId: MOCK_PLAN_ID,
    date: toISO(addDays(monday, spec.dayOffset)),
    type: spec.type,
    title: spec.title,
    duration: spec.duration,
    distance: spec.distance,
    elevation: spec.elevation,
    intensity: spec.intensity,
    estimatedCharge: estimateCharge(spec.duration, spec.intensity, spec.elevation),
    status: 'planned',
  }))
})()

// ─── Garde-fou prod ─────────────────────────────────────────────────────────
function isMockEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_PLAN_MOCK === '1') return true
  return process.env.NODE_ENV === 'development'
}

/**
 * Seed les données mock si le storage est vide.
 * - No-op en prod (sauf flag NEXT_PUBLIC_PLAN_MOCK=1).
 * - N'écrase JAMAIS des données existantes.
 * - Tente Supabase via les helpers de storage ; fallback localStorage géré nativement.
 *
 * Retourne `true` si au moins une écriture a eu lieu — permet à l'appelant
 * d'éviter un reload inutile quand le seed est un no-op (cas prod ou dev avec
 * données déjà présentes), qui sinon provoque un 2e fetch en cascade de tous
 * les blocs Plan juste après le 1er fetch au mount.
 */
export async function seedMockDataIfEmpty(): Promise<boolean> {
  if (!isMockEnabled()) return false
  if (typeof window === 'undefined') return false

  let didSeed = false
  try {
    const existingRace = await getRace()
    if (!existingRace) {
      await saveRace(MOCK_RACE)
      didSeed = true
    }

    const existingPlan = await getCurrentPlan()
    if (!existingPlan) {
      await saveCurrentPlan(MOCK_PLAN)
      didSeed = true
    }

    if (MOCK_PLANNED_SESSIONS.length > 0) {
      const first = MOCK_PLANNED_SESSIONS[0].date
      const last = MOCK_PLANNED_SESSIONS[MOCK_PLANNED_SESSIONS.length - 1].date
      const existing = await getPlannedSessions(first, last)
      if (existing.length === 0) {
        for (const s of MOCK_PLANNED_SESSIONS) {
          await savePlannedSession(s)
        }
        didSeed = true
      }
    }
  } catch (err) {
    // Mock = nice-to-have ; on n'interrompt pas le rendu si le seed plante.
    console.warn('[plan mock] seed failed:', err)
  }
  return didSeed
}
