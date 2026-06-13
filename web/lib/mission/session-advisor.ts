// Moteur de suggestion de séances — RÈGLES déterministes (pas d'IA).
// Entrées résumées (numbers/strings) → conseil par jour. Pur, testable isolément.
// Fondé sur le modèle de charge/fraîcheur de l'app (cf. spec) — non arbitraire.
// Aucune chaîne UI ici : les raisons sont des CODES traduits par l'i18n.

import type { FreshnessZone } from '@/lib/analytics/charge-insights.types'
import type { IntensityLevel, SessionType } from '@/types/plan'

export type ReasonCode =
  | 'fresh-quality'      // frais → place à la qualité
  | 'fatigue-easy'       // fatigue → facile
  | 'rest-recovery'      // repos conseillé
  | 'fill-volume-long'   // sortie longue pour la cible (param = km restants)
  | 'fill-volume-easy'   // footing pour compléter le volume
  | 'taper-light'        // affûtage : on allège
  | 'maintain-rhythm'    // sans course : on entretient le rythme
  | 'aerobic-base'       // travail aérobie

export type SuggestedSession = {
  type: SessionType
  titleKey: string            // clé i18n du libellé court (ex : 'sessionSeuil')
  durationMin: number
  distanceKm?: number
  intensity: IntensityLevel
  reasonCode: ReasonCode
  reasonParam?: number        // ex : km restants pour 'fill-volume-long'
}

export type DayAdvice =
  | { kind: 'suggested'; session: SuggestedSession }
  | { kind: 'rest'; reasonCode: ReasonCode }
  | { kind: 'planned' }       // déjà planifié → l'UI affiche la PlannedSession

export type AdviceContext = {
  todayISO: string
  weekDates: string[]          // 7 dates ISO lun→dim de la semaine courante
  freshnessZone: FreshnessZone | null
  weekDoneKm: number
  recentHardCount: number      // nb séances qualité (intensité ≥ 4) déjà faites cette semaine
  targetKm: number | null      // cible hebdo (plan) ou rythme habituel
  phaseLabel: string | null    // 'Base' | 'Spécifique' | 'Affûtage' | … | null
  daysToRace: number | null
  plannedDates: string[]       // jours déjà planifiés (on ne remplit pas)
}

export type WeekAdvice = { today: DayAdvice; byDate: Record<string, DayAdvice> }

const dowUTC = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay()
const isTaper = (ctx: AdviceContext): boolean =>
  ctx.phaseLabel === 'Affûtage' || (ctx.daysToRace != null && ctx.daysToRace <= 10)
const isFatigued = (z: FreshnessZone | null): boolean => z === 'high-fatigue'

// Séance « qualité » du jour selon la fraîcheur / phase.
function qualitySession(ctx: AdviceContext): SuggestedSession {
  if (isTaper(ctx)) {
    return { type: 'seuil_tempo', titleKey: 'sessionTempoCourt', durationMin: 50, distanceKm: 9, intensity: 4, reasonCode: 'taper-light' }
  }
  return { type: 'seuil_tempo', titleKey: 'sessionSeuil', durationMin: 65, distanceKm: 13, intensity: 4, reasonCode: 'fresh-quality' }
}

function easySession(reason: ReasonCode): SuggestedSession {
  return { type: 'footing', titleKey: 'sessionFooting', durationMin: 45, distanceKm: 8, intensity: 2, reasonCode: reason }
}

function longSession(remainingKm: number): SuggestedSession {
  return { type: 'sortie_longue', titleKey: 'sessionLong', durationMin: 105, distanceKm: Math.max(15, Math.round(remainingKm)), intensity: 2, reasonCode: 'fill-volume-long', reasonParam: Math.round(remainingKm) }
}

// Conseil pour UN jour donné (hors jours planifiés, gérés par l'appelant).
// `remainingKm` = reste-à-faire de la SEMAINE (constant, calculé une fois) — on
// ne le décrémente pas jour par jour, sinon les footings de début de semaine
// « mangeraient » le budget avant le samedi et tueraient la sortie longue.
function adviseDay(iso: string, ctx: AdviceContext, remainingKm: number): DayAdvice {
  const dow = dowUTC(iso)
  const weekend = dow === 0 || dow === 6
  if (isFatigued(ctx.freshnessZone)) {
    return weekend ? { kind: 'suggested', session: easySession('fatigue-easy') }
                   : { kind: 'rest', reasonCode: 'rest-recovery' }
  }
  // Sortie longue le SAMEDI si la cible hebdo n'est pas atteinte (hors affûtage).
  if (dow === 6 && remainingKm > 10 && !isTaper(ctx)) {
    return { kind: 'suggested', session: longSession(remainingKm) }
  }
  // Qualité : aujourd'hui, si pas déjà faite cette semaine ET qu'on a une prépa.
  if (iso === ctx.todayISO && ctx.recentHardCount === 0 && ctx.phaseLabel !== null) {
    return { kind: 'suggested', session: qualitySession(ctx) }
  }
  // Sinon : facile / aérobie / rythme.
  const reason: ReasonCode = ctx.phaseLabel === null ? 'maintain-rhythm'
    : remainingKm > 5 ? 'fill-volume-easy' : 'aerobic-base'
  return { kind: 'suggested', session: easySession(reason) }
}

export function adviseWeek(ctx: AdviceContext): WeekAdvice {
  const planned = new Set(ctx.plannedDates)
  const remaining = Math.max(0, (ctx.targetKm ?? 0) - ctx.weekDoneKm)
  const byDate: Record<string, DayAdvice> = {}
  for (const iso of ctx.weekDates) {
    if (planned.has(iso)) { byDate[iso] = { kind: 'planned' }; continue }
    if (iso < ctx.todayISO) { byDate[iso] = { kind: 'rest', reasonCode: 'rest-recovery' }; continue } // passé non réalisé → repos
    byDate[iso] = adviseDay(iso, ctx, remaining)
  }
  return { today: byDate[ctx.todayISO] ?? { kind: 'rest', reasonCode: 'rest-recovery' }, byDate }
}
