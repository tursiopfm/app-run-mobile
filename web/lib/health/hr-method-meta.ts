import type { HrZoneMethod } from './hr-zones'

export type HrMethodMeta = {
  value:       HrZoneMethod
  label:       string
  description: string
  badge:       string
  color:       string    // hex couleur de fiabilité
  badgeBg:     string    // background du badge (couleur + alpha)
}

export const HR_METHODS: HrMethodMeta[] = [
  {
    value: 'seuils',
    label: 'Seuils physiologiques',
    description: 'Le plus précis : seuils aérobie + anaérobie mesurés.',
    badge: 'Excellent',
    color: '#22c55e',
    badgeBg: '#16a34a33',
  },
  {
    value: 'test30',
    label: 'Test terrain 30 min',
    description: 'Test 30 min : FC moyenne des 20 dernières minutes = ta LTHR.',
    badge: 'Très bien',
    color: '#22c55e',
    badgeBg: '#16a34a33',
  },
  {
    value: 'karvonen',
    label: 'Réserve FC / Karvonen',
    description: 'Basé sur la FC max + FC repos. Plus pertinent qu\'un simple % de FC max.',
    badge: 'Bien',
    color: '#facc15',
    badgeBg: '#eab30833',
  },
  {
    value: 'pct_max',
    label: '% FC max',
    description: 'Simple : uniquement la FC max.',
    badge: 'Correct',
    color: '#fb923c',
    badgeBg: '#e8651a33',
  },
  {
    value: 'auto',
    label: 'Estimation automatique',
    description: 'FC max estimée par l\'âge (208 − 0.7 × âge).',
    badge: 'Approximatif',
    color: '#f87171',
    badgeBg: '#ef444433',
  },
  {
    value: 'deduced',
    label: 'Déduire automatiquement',
    description: 'L\'app analyse ton historique Strava pour déduire FC max observée, FC repos et seuils.',
    badge: 'Adaptatif',
    color: '#fb923c',
    badgeBg: '#e8651a33',
  },
  {
    value: 'custom',
    label: 'Personnalisé',
    description: 'Tu saisis tes 5 zones manuellement (Z1 à Z5).',
    badge: 'Custom',
    color: '#9ca3af',
    badgeBg: '#6b728033',
  },
]

export function getMethodMeta(method: HrZoneMethod): HrMethodMeta {
  return HR_METHODS.find(m => m.value === method) ?? HR_METHODS[0]
}

export type RequiredField =
  | 'max_hr' | 'aerobic_threshold_hr' | 'threshold_hr' | 'resting_hr'
  | 'birth_year' | 'hr_zones_custom'

export function requiredFieldsFor(method: HrZoneMethod): RequiredField[] {
  switch (method) {
    case 'seuils':   return ['max_hr', 'aerobic_threshold_hr', 'threshold_hr']
    case 'test30':   return ['max_hr', 'threshold_hr']
    case 'karvonen': return ['max_hr', 'resting_hr']
    case 'pct_max':  return ['max_hr']
    case 'auto':     return ['birth_year']
    case 'deduced':  return []
    case 'custom':   return ['hr_zones_custom']
  }
}
