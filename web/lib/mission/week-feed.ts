// Fusion réalisé + planifié + suggéré pour le bloc « Ma semaine ». Pur.
// Priorité par jour : réalisé > planifié > suggéré. La catégorie sert à colorer
// la pastille (run/bike/swim/other).

import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { PlannedSession } from '@/types/plan'
import type { WeekAdvice, SuggestedSession, ReasonCode } from '@/lib/mission/session-advisor'
import { activityCategory } from '@/lib/plan/session-matching'
import type { SessionCategory } from '@/lib/plan/session-meta'

// Catégorie d'un type de séance — catalog-free (week-feed reste pur, pas de
// fetch). Couvre les types BUILTIN ; custom/inconnu → 'run' (app trail-centrée).
const TYPE_CATEGORY: Record<string, SessionCategory> = {
  course: 'run', sortie_longue: 'run', fractionne: 'run', seuil_tempo: 'run',
  cotes: 'run', footing: 'run', runtaf: 'run',
  velo: 'bike', velotaf: 'bike', natation: 'swim', renfo: 'other', musculation: 'other',
}
export function sessionCategory(type: string): SessionCategory { return TYPE_CATEGORY[type] ?? 'run' }

export type FeedEntry =
  | { date: string; isToday: boolean; kind: 'done'; category: SessionCategory; title: string; count: number; km: number; dPlus: number; durationSec: number; activityId: string; multiple: boolean }
  | { date: string; isToday: boolean; kind: 'planned'; category: SessionCategory; session: PlannedSession; completed: boolean }
  | { date: string; isToday: boolean; kind: 'suggested'; category: SessionCategory; session: SuggestedSession }
  | { date: string; isToday: boolean; kind: 'rest'; reasonCode: ReasonCode }

type Args = {
  weekDates: string[]
  todayISO: string
  activities: ActivityRow[]
  planned: PlannedSession[]
  advice: WeekAdvice
}

function km(a: ActivityRow): number { return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000 }
function dplus(a: ActivityRow): number { return Math.round(a.manual_elevation_gain_m ?? a.elevation_gain_m ?? 0) }
function durSec(a: ActivityRow): number { return a.manual_moving_time_sec ?? a.moving_time_sec ?? 0 }
function effSport(a: ActivityRow): string { return a.manual_sport_type ?? a.sport_type }

export function buildWeekFeed({ weekDates, todayISO, activities, planned, advice }: Args): FeedEntry[] {
  const actsByDay = new Map<string, ActivityRow[]>()
  for (const a of activities) {
    const d = a.start_time.slice(0, 10)
    const arr = actsByDay.get(d); if (arr) arr.push(a); else actsByDay.set(d, [a])
  }
  const planByDay = new Map(planned.map(s => [s.date, s]))

  return weekDates.map((date): FeedEntry => {
    const isToday = date === todayISO
    const acts = actsByDay.get(date) ?? []
    if (acts.length > 0) {
      const totKm = acts.reduce((s, a) => s + km(a), 0)
      const totDp = acts.reduce((s, a) => s + dplus(a), 0)
      const totSec = acts.reduce((s, a) => s + durSec(a), 0)
      const main = acts[0]
      // Pas de chaîne UI ici (module pur) : on renvoie le nom + le nombre,
      // l'UI formate « N séances » via i18n quand multiple.
      return {
        date, isToday, kind: 'done',
        category: activityCategory(effSport(main)),
        title: main.name, count: acts.length,
        km: Math.round(totKm * 10) / 10, dPlus: totDp, durationSec: totSec,
        activityId: main.id, multiple: acts.length > 1,
      }
    }
    const p = planByDay.get(date)
    if (p) {
      return { date, isToday, kind: 'planned', category: sessionCategory(p.type), session: p, completed: p.status === 'completed' }
    }
    const a = advice.byDate[date] ?? { kind: 'rest', reasonCode: 'rest-recovery' as ReasonCode }
    if (a.kind === 'suggested') {
      return { date, isToday, kind: 'suggested', category: sessionCategory(a.session.type), session: a.session }
    }
    return { date, isToday, kind: 'rest', reasonCode: a.kind === 'rest' ? a.reasonCode : 'rest-recovery' }
  })
}
