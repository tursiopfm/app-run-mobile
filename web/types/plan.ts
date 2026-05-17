// Types pour l'onglet Plan (mode Manuel).
// SessionType est aliasé sur WorkoutType (l'enum existant dans le repo).
// IntensityLevel est défini dans lib/activities/indicators.ts (1..5).

import type { WorkoutType } from '@/lib/activities/intensity'
import type { IntensityLevel } from '@/lib/activities/indicators'

export type SessionType = WorkoutType
export type { IntensityLevel }

// === Phases de prépa (mésocycles) ===
export type PhaseType =
  | 'foncier'
  | 'developpement'
  | 'specifique'
  | 'affutage'
  | 'recuperation'

export interface Phase {
  id: string
  type: PhaseType
  label: string                   // ex : 'Phase Foncier'
  startDate: string               // ISO (YYYY-MM-DD)
  endDate: string                 // ISO (YYYY-MM-DD)
  weeklyChargeTarget: number      // TSS cible / semaine
  weeklyDistanceKmTarget: number  // km cible / semaine
  weeklyElevationMTarget: number  // D+ cible / semaine (m)
  description?: string
}

// === Course objectif ===
export type RaceType = 'trail' | 'ultra' | 'route' | 'cross' | 'skyrace'

export interface Race {
  id: string
  name: string
  date: string               // ISO (YYYY-MM-DD)
  distance: number           // km
  elevation: number          // m D+
  type: RaceType
  location?: string
  isMain: boolean            // course objectif principale
  notes?: string
}

// === Plan d'entraînement (macrocycle) ===
export interface TrainingPlan {
  id: string
  athleteId: string
  name: string
  goalRaceId: string | null
  startDate: string          // ISO (YYYY-MM-DD)
  endDate: string            // ISO (YYYY-MM-DD)
  phases: Phase[]
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
