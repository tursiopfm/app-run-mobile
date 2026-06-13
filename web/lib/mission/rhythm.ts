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

// Rythme habituel = moyenne des semaines ANTÉRIEURES (hors semaine courante)
// sur 4 semaines glissantes. Sert de cible quand l'athlète n'a pas de plan.
export function habitualWeekly(activities: ActivityRow[], todayISO: string): { km: number; dPlus: number } {
  // Exclure les activités des 3 derniers jours
  const currentDayBoundary = new Date(`${todayISO}T00:00:00Z`)
  currentDayBoundary.setUTCDate(currentDayBoundary.getUTCDate() - 3)
  const boundaryISO = currentDayBoundary.toISOString()

  const prevActivities = activities.filter(a => a.start_time < boundaryISO)

  if (prevActivities.length === 0) return { km: 0, dPlus: 0 }

  // Obtenir 4 semaines de données
  const allWeeks = weeklyVolumes(prevActivities, todayISO, 4)
  // Exclure les semaines sans activité
  const nonZeroWeeks = allWeeks.filter(w => w.km > 0 || w.dPlus > 0)

  if (nonZeroWeeks.length === 0) return { km: 0, dPlus: 0 }

  const sum = nonZeroWeeks.reduce((s, w) => ({ km: s.km + w.km, dPlus: s.dPlus + w.dPlus }), { km: 0, dPlus: 0 })
  return { km: Math.round(sum.km / nonZeroWeeks.length), dPlus: Math.round(sum.dPlus / nonZeroWeeks.length) }
}
