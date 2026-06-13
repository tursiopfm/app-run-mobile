// Moteur de suggestion de séances — RÈGLES déterministes (pas d'IA).
// Entrées résumées (numbers/strings) → conseil par jour. Pur, testable isolément.
// Fondé sur le modèle de charge/fraîcheur de l'app (cf. spec) — non arbitraire.
// Aucune chaîne UI ici : les raisons sont des CODES traduits par l'i18n.

import type { FreshnessZone } from '@/lib/analytics/charge-insights.types'
import type { IntensityLevel, PhaseType, SessionType } from '@/types/plan'

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
  phaseType: PhaseType | null  // type stable de la phase active (null = pas de prépa)
  daysToRace: number | null
  plannedDates: string[]       // jours déjà planifiés (on ne remplit pas)
  plannedRemainingKm: number   // km des séances planifiées encore à venir cette semaine
  hasPlannedLongRun: boolean   // une sortie longue / course est déjà planifiée cette semaine
}

export type WeekAdvice = { today: DayAdvice; byDate: Record<string, DayAdvice> }

const dowUTC = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay()
const isTaper = (ctx: AdviceContext): boolean =>
  ctx.phaseType === 'affutage' || (ctx.daysToRace != null && ctx.daysToRace <= 10)
// Seule la fatigue MARQUÉE (high-fatigue) déclenche easy/repos — aligné avec
// formeVerdict() : la fatigue « normale » fait partie de l'entraînement.
const isFatigued = (z: FreshnessZone | null): boolean => z === 'high-fatigue'

// Durée/distance TOUJOURS cohérentes : on dérive la distance de la durée via
// une allure (min/km) par intensité. Évite les absurdités type « 1h45 · 73 km ».
const PACE_MIN_PER_KM: Record<number, number> = { 1: 6.6, 2: 6.0, 3: 5.4, 4: 5.0, 5: 4.6 }
function distanceFor(durationMin: number, intensity: IntensityLevel): number {
  return Math.round(durationMin / (PACE_MIN_PER_KM[intensity] ?? 6))
}

// Séance « qualité » du jour selon la fraîcheur / phase.
function qualitySession(ctx: AdviceContext): SuggestedSession {
  if (isTaper(ctx)) {
    return { type: 'seuil_tempo', titleKey: 'sessionTempoCourt', durationMin: 45, distanceKm: distanceFor(45, 4), intensity: 4, reasonCode: 'taper-light' }
  }
  return { type: 'seuil_tempo', titleKey: 'sessionSeuil', durationMin: 60, distanceKm: distanceFor(60, 4), intensity: 4, reasonCode: 'fresh-quality' }
}

function easySession(reason: ReasonCode): SuggestedSession {
  return { type: 'footing', titleKey: 'sessionFooting', durationMin: 45, distanceKm: distanceFor(45, 2), intensity: 2, reasonCode: reason }
}

// Sortie longue dimensionnée sur la cible hebdo (≈ 30 % du volume), bornée à
// une taille réaliste [16, 32] km, durée DÉRIVÉE de la distance (allure facile).
function longSession(targetKm: number | null): SuggestedSession {
  const km = Math.min(32, Math.max(16, Math.round((targetKm ?? 0) * 0.3)))
  const durationMin = Math.round(km * PACE_MIN_PER_KM[2])
  return { type: 'sortie_longue', titleKey: 'sessionLong', durationMin, distanceKm: km, intensity: 2, reasonCode: 'fill-volume-long' }
}

// Conseil pour UN jour donné (hors jours planifiés, gérés par l'appelant).
// `remainingKm` = reste-à-faire de la semaine APRÈS le réalisé ET les séances
// déjà planifiées → on ne re-suggère pas du volume déjà couvert par le plan.
function adviseDay(iso: string, ctx: AdviceContext, remainingKm: number): DayAdvice {
  const dow = dowUTC(iso)
  const weekend = dow === 0 || dow === 6
  if (isFatigued(ctx.freshnessZone)) {
    return weekend ? { kind: 'suggested', session: easySession('fatigue-easy') }
                   : { kind: 'rest', reasonCode: 'rest-recovery' }
  }
  // Sortie longue le SAMEDI — seulement s'il n'y en a pas DÉJÀ une planifiée
  // cette semaine (on ne double pas le plan), hors affûtage, et si le volume
  // restant le justifie.
  if (dow === 6 && !ctx.hasPlannedLongRun && !isTaper(ctx) && remainingKm > 12) {
    return { kind: 'suggested', session: longSession(ctx.targetKm) }
  }
  // Qualité : en SEMAINE (pas le week-end), aujourd'hui, si pas déjà faite et qu'on a une prépa.
  if (iso === ctx.todayISO && !weekend && ctx.recentHardCount === 0 && ctx.phaseType !== null) {
    return { kind: 'suggested', session: qualitySession(ctx) }
  }
  // Sinon : facile / aérobie / rythme.
  const reason: ReasonCode = ctx.phaseType === null ? 'maintain-rhythm'
    : remainingKm > 5 ? 'fill-volume-easy' : 'aerobic-base'
  return { kind: 'suggested', session: easySession(reason) }
}

export function adviseWeek(ctx: AdviceContext): WeekAdvice {
  const planned = new Set(ctx.plannedDates)
  // Reste-à-faire = cible − réalisé − volume déjà planifié (à venir).
  const remaining = Math.max(0, (ctx.targetKm ?? 0) - ctx.weekDoneKm - ctx.plannedRemainingKm)
  const byDate: Record<string, DayAdvice> = {}
  for (const iso of ctx.weekDates) {
    if (planned.has(iso)) { byDate[iso] = { kind: 'planned' }; continue }
    if (iso < ctx.todayISO) { byDate[iso] = { kind: 'rest', reasonCode: 'rest-recovery' }; continue } // passé non réalisé → repos
    byDate[iso] = adviseDay(iso, ctx, remaining)
  }
  return { today: byDate[ctx.todayISO] ?? { kind: 'rest', reasonCode: 'rest-recovery' }, byDate }
}

// ── Curseur « forme du jour » ───────────────────────────────────────────────
// Ajuste la séance du jour autour de la recommandation (pos 2 = « Prévu »).
// 0 Repos · 1 Allégé · 2 Prévu · 3 Renforcé · 4 Max. Type-aware : pour une séance
// d'endurance on joue sur la DURÉE (rallonger/raccourcir) ; pour une séance de
// qualité, « allégé » = footing facile, « renforcé/max » = plus de volume.
export type SliderBase = {
  type: SessionType; titleKey?: string; title?: string
  durationMin: number; distanceKm?: number; intensity: IntensityLevel
}
export type SliderOutcome =
  | { kind: 'rest' }
  | { kind: 'session'; type: SessionType; titleKey?: string; title?: string; durationMin: number; distanceKm?: number; intensity: IntensityLevel }

const scaleKm = (km: number | undefined, f: number): number | undefined => km != null ? Math.round(km * f) : undefined

export function applySlider(base: SliderBase | null, pos: number): SliderOutcome {
  if (pos <= 0) return { kind: 'rest' }
  // Recommandation = repos : on ne propose une séance qu'en poussant à droite.
  if (!base) {
    if (pos <= 2) return { kind: 'rest' }
    if (pos === 3) return { kind: 'session', type: 'footing', titleKey: 'sessionFooting', durationMin: 45, distanceKm: 8, intensity: 2 }
    return { kind: 'session', type: 'footing', titleKey: 'sessionFooting', durationMin: 60, distanceKm: 11, intensity: 3 }
  }
  if (pos === 2) return { kind: 'session', ...base }
  const isQuality = base.intensity >= 4
  if (isQuality) {
    if (pos === 1) {
      return { kind: 'session', type: 'footing', titleKey: 'sessionFooting', durationMin: Math.round(base.durationMin * 0.7), distanceKm: scaleKm(base.distanceKm, 0.7), intensity: 2 }
    }
    const f = pos === 3 ? 1.15 : 1.3
    return { kind: 'session', ...base, durationMin: Math.round(base.durationMin * f), distanceKm: scaleKm(base.distanceKm, f) }
  }
  // Endurance : on étire/raccourcit la durée (et la distance).
  const f = pos === 1 ? 0.7 : pos === 3 ? 1.3 : 1.6
  return { kind: 'session', ...base, durationMin: Math.round(base.durationMin * f), distanceKm: scaleKm(base.distanceKm, f) }
}
