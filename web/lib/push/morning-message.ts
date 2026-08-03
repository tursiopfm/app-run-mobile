import type { StatusId } from '@/lib/analytics/charge-insights.types'
import { fr } from '@/lib/i18n/dictionaries/fr'
import { formatDurationHHmm } from '@/lib/training/duration'

// Heure d'envoi et bornes de la fenêtre où le cron accepte d'agir, en heure
// locale de Paris. La borne basse absorbe le changement d'heure ; la borne
// haute évite qu'un déclenchement égaré en pleine journée n'envoie une
// notification « matinale » à 22h.
//
// La borne haute était à 10h. Le 2026-08-03, GitHub Actions n'a exécuté qu'UN
// seul des 12 déclenchements planifiés, avec 1h45 de retard sur le dernier :
// le run est arrivé à 10h44 et s'est fait refuser, personne n'a rien reçu.
// GitHub ne rattrape pas les occurrences manquées et 05:00-06:00 UTC est une
// heure de pointe (tout le monde planifie aux heures rondes). Midi laisse
// désormais cinq heures de marge ; l'idempotence de last_notified_on garantit
// qu'un seul envoi passe, quel que soit le tick qui arrive.
const PARIS_TZ = 'Europe/Paris'
export const MORNING_HOUR = 7
export const MORNING_WINDOW_END_HOUR = 12

export type TodaySessionLite = {
  title:    string
  duration: number         // minutes
  distance: number | null  // km
}

// hourCycle 'h23' est explicite : certains moteurs renvoient "24" pour minuit
// avec le cycle par défaut de en-GB.
export function hourInTimeZone(when: Date, timeZone: string = PARIS_TZ): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', hourCycle: 'h23',
  }).format(when))
}

// en-CA formate nativement en YYYY-MM-DD.
export function dateInTimeZone(when: Date, timeZone: string = PARIS_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(when)
}

export function isMorningWindow(when: Date, timeZone: string = PARIS_TZ): boolean {
  const h = hourInTimeZone(when, timeZone)
  return h >= MORNING_HOUR && h < MORNING_WINDOW_END_HOUR
}

function sessionLine(session: TodaySessionLite | null): string {
  if (!session) return 'Aucune séance prévue'
  const base = `${session.title} — ${formatDurationHHmm(session.duration)}`
  return session.distance != null ? `${base} · ${session.distance} km` : base
}

// Les libellés du dictionnaire se terminent par un point ; on le retire pour
// ne pas écrire « … jours. · Sortie longue ».
function verdictLine(status: StatusId): string {
  return fr.charge.verdict[status].action.replace(/\.$/, '')
}

export function buildMorningNotification(
  status:  StatusId,
  session: TodaySessionLite | null,
): { title: string; body: string; url: string } {
  return {
    title: 'Rapport matinal',
    body:  `${verdictLine(status)} · ${sessionLine(session)}`,
    url:   '/rapport-matinal',
  }
}
