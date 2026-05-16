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
  zones?: TrainingZone[]
  notes?: string
  status: SessionStatus
  linkedActivityId?: string  // FK vers Activity quand réalisée
  templateId?: string        // si créée depuis un template
}

// === Bloc structuré d'une séance (échauffement, séries, retour calme) ===
export type ZoneKind = 'warmup' | 'main' | 'rest' | 'cooldown'

export interface TrainingZone {
  id: string
  kind: ZoneKind
  durationMin: number
  intensity: IntensityLevel
  repeats?: number           // pour les séries
  label?: string             // ex : '500m allure VMA'
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
  defaultZones?: TrainingZone[]
  description: string
  tags?: string[]            // ex : ['VMA', 'piste', 'court']
}
