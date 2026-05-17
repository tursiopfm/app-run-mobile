// Types pour le catalogue d'activités (Phase 2 — onglet Plan / bloc Bibliothèque).
// Persistance : tables `activity_types` + `user_activity_prefs` (migration 018).

import type { IntensityLevel } from '@/types/plan'

// === Type d'activité (système ou custom user) ===
export interface ActivityType {
  id: string                       // uuid
  slug: string                     // ex: 'sortie_longue', 'tennis'
  label: string                    // ex: 'Sortie longue', 'Tennis'
  defaultIntensity: IntensityLevel
  category?: 'run' | 'bike' | 'swim' | 'other'
  isSystem: boolean                // true pour les 9 par défaut, false pour les custom user
}

// === Préférence user pour un type donné (visibilité + ordre dans la barre de pills) ===
export interface UserActivityPref {
  activitySlug: string
  isVisible: boolean
  displayOrder: number             // 0 = premier, plus haut = plus à droite
}
