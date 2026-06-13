// Agrégation des activités en volumes hebdomadaires (km, D+) pour le bloc
// « Ton rythme » et la cible-rythme du moteur de suggestion. Pur.

import type { ActivityRow } from '@/components/ui/ActivityCard'

export type WeeklyVolume = { weekStart: string; km: number; dPlus: number }

function km(a: ActivityRow): number {
  return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000
}
function dplus(a: ActivityRow): number {
  return Math.round(a.manual_elevation_gain_m ?? a.elevation_gain_m ?? 0)
}

// Lundi (UTC) de la semaine contenant dateISO. start_time = heure locale
// étiquetée UTC → getters UTC.
function mondayUTC(dateISO: string): string {
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`)
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - (dow - 1))
  return d.toISOString().slice(0, 10)
}

function addWeeksISO(mondayISO: string, n: number): string {
  const d = new Date(`${mondayISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

// `count` dernières semaines (incluant celle de todayISO), de la plus ancienne
// à la plus récente. Chaque semaine est émise même sans activité (km=0).
export function weeklyVolumes(activities: ActivityRow[], todayISO: string, count: number): WeeklyVolume[] {
  const thisMonday = mondayUTC(todayISO)
  const weeks: WeeklyVolume[] = []
  for (let i = count - 1; i >= 0; i--) {
    weeks.push({ weekStart: addWeeksISO(thisMonday, -i), km: 0, dPlus: 0 })
  }
  const byStart = new Map(weeks.map(w => [w.weekStart, w]))
  for (const a of activities) {
    const w = byStart.get(mondayUTC(a.start_time))
    if (w) { w.km += km(a); w.dPlus += dplus(a) }
  }
  return weeks.map(w => ({ ...w, km: Math.round(w.km), dPlus: Math.round(w.dPlus) }))
}

// Rythme habituel = moyenne des 4 semaines ISO ANTÉRIEURES (hors semaine
// courante, zéros inclus). Sert de cible quand l'athlète n'a pas de plan.
// On inclut les semaines à 0 volontairement : pour une CIBLE de séances, mieux
// vaut sous-estimer (athlète qui s'entraîne par à-coups) que gonfler la charge.
export function habitualWeekly(activities: ActivityRow[], todayISO: string): { km: number; dPlus: number } {
  // weeklyVolumes(…, 5) = 4 semaines antérieures + la courante ; slice(0,4)
  // retire la semaine courante (dernière du tableau, ordre ancien→récent).
  const priorWeeks = weeklyVolumes(activities, todayISO, 5).slice(0, 4)
  const n = priorWeeks.length || 1
  const sum = priorWeeks.reduce((s, w) => ({ km: s.km + w.km, dPlus: s.dPlus + w.dPlus }), { km: 0, dPlus: 0 })
  return { km: Math.round(sum.km / n), dPlus: Math.round(sum.dPlus / n) }
}
