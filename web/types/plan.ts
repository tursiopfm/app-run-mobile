// Types pour l'onglet Plan (mode Manuel).
// SessionType est libre (string) pour accepter les slugs custom du catalogue
// activity_types. Les 12 builtins sont listés dans BUILTIN_SESSION_TYPES.
// WorkoutType (lib/activities/intensity.ts) reste l'enum fermé côté Activités.

import type { IntensityLevel } from '@/lib/activities/indicators'

export type SessionType = string

export const BUILTIN_SESSION_TYPES = [
  'course',
  'sortie_longue',
  'fractionne',
  'seuil_tempo',
  'cotes',
  'runtaf',
  'velotaf',
  'footing',
  'velo',
  'natation',
  'renfo',
  'musculation',
] as const

export type BuiltinSessionType = typeof BUILTIN_SESSION_TYPES[number]

export function isBuiltinSessionType(t: string): t is BuiltinSessionType {
  return (BUILTIN_SESSION_TYPES as readonly string[]).includes(t)
}

export type { IntensityLevel }

// === Phases de prépa (mésocycles) ===
export type PhaseType =
  | 'foncier'
  | 'developpement'
  | 'specifique'
  | 'affutage'
  | 'recuperation'

export type LoadPattern =
  | 'progressive_3_1'
  | 'progressive_2_1'
  | 'taper'
  | 'maintenance'
  | 'recovery'
  | 'competition'
  | 'custom'

export type WeekType =
  | 'load' | 'deload' | 'recovery' | 'taper' | 'race' | 'transition' | 'custom'

export interface MesocycleWeek {
  id: string
  phaseId: string
  weekIndex: number
  weekStartDate: string
  weekType: WeekType
  targetLoadTss: number
  targetVolumeKm: number
  targetDplusM: number
  comment?: string
  isManualOverride: boolean
  generatedFromPattern: boolean
}

export interface PhaseWeeklyTarget {
  km: number     // km cible pour cette semaine
  dPlus: number  // D+ cible (m) pour cette semaine
}

export interface Phase {
  id: string
  type: PhaseType
  label: string                   // ex : 'Phase Foncier'
  startDate: string               // ISO (YYYY-MM-DD)
  endDate: string                 // ISO (YYYY-MM-DD)
  weeklyChargeTarget: number      // TSS cible / semaine
  weeklyDistanceKmTarget: number  // km cible / semaine (défaut, appliqué si weeklyTargets absent)
  weeklyElevationMTarget: number  // D+ cible / semaine (m) (défaut)
  /**
   * Cibles km / D+ semaine par semaine (overrides). Indexé par numéro de
   * semaine dans la phase (0-based). Si absent ou plus court que le nombre
   * de semaines, les semaines non couvertes retombent sur les défauts
   * `weeklyDistanceKmTarget` / `weeklyElevationMTarget`.
   */
  weeklyTargets?: PhaseWeeklyTarget[]
  focus?: string                  // focus libre du cycle (ex : "VMA courte")
  loadPattern: LoadPattern        // pattern de progression (default 'custom' from DB)
  description?: string
}

// === Course objectif ===
export type RaceType = 'trail' | 'ultra' | 'route' | 'cross' | 'skyrace'

export type RacePriority = 'A' | 'B' | 'C'

export interface Race {
  id: string
  name: string
  date: string               // ISO (YYYY-MM-DD)
  distance: number           // km
  elevation: number          // m D+
  type: RaceType
  location?: string
  isMain: boolean            // course objectif principale
  priority: RacePriority     // priorité A/B/C (default 'C' from DB)
  notes?: string
}

// === Plan d'entraînement (macrocycle) ===
export type MacrocycleStatus = 'planned' | 'active' | 'completed' | 'archived'

export interface TrainingPlan {
  id: string
  athleteId: string
  name: string
  goalRaceId: string | null
  startDate: string          // ISO (YYYY-MM-DD)
  endDate: string            // ISO (YYYY-MM-DD)
  phases: Phase[]
  status: MacrocycleStatus   // default 'active'
  color?: string             // couleur d'affichage du macrocycle
  templateId?: string        // si le plan a été créé depuis un template
  createdAt: string          // ISO timestamp
  updatedAt: string          // ISO timestamp
}

// === Séance planifiée (différente d'une Activity réalisée) ===
export type SessionStatus = 'planned' | 'completed' | 'skipped' | 'moved'

export interface PlannedSession {
  id: string
  planId: string
  date: string               // ISO (YYYY-MM-DD)
  type: SessionType
  title: string
  duration: number           // min
  distance?: number          // km
  elevation?: number         // m D+
  intensity: IntensityLevel  // 1=Récup … 5=VMA
  estimatedCharge: number    // TSS estimé
  zones?: SessionZone[]
  notes?: string
  status: SessionStatus
  linkedActivityId?: string  // FK vers Activity quand réalisée
  templateId?: string        // si créée depuis un template
}

// === Bloc structuré d'une séance (échauffement, séries, retour calme) ===
export type ZoneKind = 'warmup' | 'main' | 'rest' | 'cooldown'

// Mode de mesure d'une zone simple
export type ZoneMode = 'duration' | 'distance'
export type IntensityMode = 'level' | 'pace'

export interface TrainingZone {
  id: string
  kind: ZoneKind
  // Durée ou distance — au moins l'un des deux doit être présent.
  // Compat : si `mode` est absent, on interprète comme 'duration' (legacy).
  mode?: ZoneMode
  durationMin: number               // toujours présent (legacy + nouveau mode 'duration')
  distanceM?: number                // requis si mode = 'distance'
  intensity: IntensityLevel
  // Compat : si `intensityMode` est absent, on interprète comme 'level' (legacy).
  intensityMode?: IntensityMode
  paceSecPerKm?: number             // requis si intensityMode = 'pace'
  repeats?: number                  // pour les séries simples (legacy, cohabite avec RepeatZone)
  label?: string
}

// === Container "Répéter" (Phase 1.6) ===
// Distinct de TrainingZone via `kind: 'repeat'`. PlannedSession.zones contient
// désormais `Array<TrainingZone | RepeatZone>`.
export interface RepeatStep {
  id: string
  stepKind: 'effort' | 'recovery'
  label?: string                    // auto-rempli ("Course à pied" / "Récupération") si vide
  mode: ZoneMode                    // requis (pas de legacy ici)
  durationMin?: number              // requis si mode = 'duration'
  distanceM?: number                // requis si mode = 'distance'
  intensityMode: IntensityMode
  intensity?: IntensityLevel        // requis si intensityMode = 'level'
  paceSecPerKm?: number             // requis si intensityMode = 'pace'
}

export interface RepeatZone {
  id: string
  kind: 'repeat'
  repeats: number                   // N fois
  skipLastRecovery?: boolean        // checkbox "Ignorer la dernière récupération"
  steps: RepeatStep[]
}

// Type union d'une entrée du tableau zones[]
export type SessionZone = TrainingZone | RepeatZone

// Type guards
export function isRepeatZone(z: SessionZone): z is RepeatZone {
  return z.kind === 'repeat'
}

// === Template de séance (bibliothèque, pas de date) ===
export interface SessionTemplate {
  id: string
  type: SessionType
  title: string
  defaultDuration: number    // min
  defaultDistance?: number   // km
  defaultElevation?: number  // m D+
  defaultIntensity: IntensityLevel
  defaultZones?: SessionZone[]
  description: string
  tags?: string[]            // ex : ['VMA', 'piste', 'court']
}
