import type { IntensityKey, WorkoutType } from '@/lib/activities/intensity'

// ── Intensity ──────────────────────────────────────────────────────────────────
export type IntensityLevel = 1 | 2 | 3 | 4 | 5

export const INTENSITY_KEY_TO_LEVEL: Record<IntensityKey, IntensityLevel> = {
  recuperation:     1,
  footing:          2,
  endurance_active: 3,
  seuil:            4,
  vma:              5,
}

export const INTENSITY_LEVEL_COLORS: Record<IntensityLevel, string> = {
  1: '#94A3B8', // slate clair — Récupération
  2: '#10B981', // vert        — Endurance
  3: '#F59E0B', // ambre       — Tempo
  4: '#F97316', // orange      — Seuil
  5: '#EF4444', // rouge       — VMA
}

export const INTENSITY_LEVEL_LABELS: Record<IntensityLevel, string> = {
  1: 'Récupération',
  2: 'Endurance',
  3: 'Tempo',
  4: 'Seuil',
  5: 'VMA',
}

// ── Charge (CES) ───────────────────────────────────────────────────────────────
export type ChargeLevel = 1 | 2 | 3 | 4 | 5

// Seuils calés sur les CES réels de l'app (cf. CES_RANGES dans ActivityPopups).
export function getChargeLevel(value: number): ChargeLevel {
  if (value <= 40)  return 1
  if (value <= 80)  return 2
  if (value <= 130) return 3
  if (value <= 200) return 4
  return 5
}

export const CHARGE_COLORS: Record<ChargeLevel, string> = {
  1: '#10B981', // vert    — Très basse / récup
  2: '#84CC16', // lime    — Basse
  3: '#F59E0B', // ambre   — Modérée
  4: '#F97316', // orange  — Élevée
  5: '#EF4444', // rouge   — Très élevée / overload
}

export const CHARGE_LABELS: Record<ChargeLevel, string> = {
  1: 'Très basse',
  2: 'Basse',
  3: 'Modérée',
  4: 'Élevée',
  5: 'Très élevée',
}

// ── Session type (réutilise WorkoutType) ───────────────────────────────────────
export const SESSION_TYPE_COLORS: Record<WorkoutType, string> = {
  course:        '#E8B968', // or            — Course (trophée)
  sortie_longue: '#86EFAC', // vert clair    — Sortie Longue (tortue)
  fractionne:    '#D85A4A', // rouge         — Fractionné (chrono)
  seuil_tempo:   '#22D3EE', // cyan vif      — Seuil / Tempo
  cotes:         '#15803D', // vert foncé    — Côtes (montagne + drapeau)
  runtaf:        '#1E40AF', // bleu marine   — Runtaf (coureur + laptop)
  velotaf:       '#B8C25F', // olive         — Velotaf (vélo + laptop)
}

export const SESSION_TYPE_LABELS: Record<WorkoutType, string> = {
  course:        'Course',
  sortie_longue: 'Sortie Longue',
  fractionne:    'Fractionné',
  seuil_tempo:   'Seuil / Tempo',
  cotes:         'Côtes',
  runtaf:        'Runtaf',
  velotaf:       'Velotaf',
}
