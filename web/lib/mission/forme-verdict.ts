// État de forme du Mode Mission : transforme la fraîcheur TSB (calcul existant,
// lib/analytics/charge-insights.computeFreshness) en un curseur visuel et un
// verdict actionnable « continuer / adapter ». Les textes vivent dans i18n
// (t.mission.formeVerdict[zone]).

import type { FreshnessZone } from '@/lib/analytics/charge-insights.types'

// Échelle visuelle Fatigué → Affûté. Bornes = seuils FRESHNESS
// (charge-thresholds: highFatigue=-25, veryFresh=15) élargis de 10 pts de
// chaque côté pour que le curseur ne sature pas aux extrêmes.
const TSB_MIN = -35
const TSB_MAX = 25

export function cursorPctFromTsb(tsb: number): number {
  const clamped = Math.min(TSB_MAX, Math.max(TSB_MIN, tsb))
  return Math.round(((clamped - TSB_MIN) / (TSB_MAX - TSB_MIN)) * 100)
}

export type FormeTone = 'continue' | 'adapt'

export type FormeVerdict = { tone: FormeTone; zone: FreshnessZone }

// Seule la fatigue élevée déclenche « adapte » ; la fatigue normale fait
// partie de l'entraînement (on rassure au lieu d'alarmer).
export function formeVerdict(zone: FreshnessZone): FormeVerdict {
  return { tone: zone === 'high-fatigue' ? 'adapt' : 'continue', zone }
}
