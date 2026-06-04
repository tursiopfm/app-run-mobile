// Formatage des dates/heures d'activité.
//
// `start_time` stocke l'heure LOCALE de l'activité, étiquetée UTC : Strava renvoie
// `start_date_local` (ex. "2026-06-04T07:50:37Z" pour une sortie lancée à 07:50 locales),
// et c'est cette valeur qui est persistée. Tout le système l'interprète comme une
// heure-mur (l'agrégation charge lit la date via `split('T')`). Il faut donc formater
// avec les getters **UTC**, sinon le navigateur reconvertit vers son fuseau et ajoute
// l'offset une 2e fois (07:50 → 09:50 à Paris).

export function formatActivityDateTime(iso: string): string {
  const d = new Date(iso)
  const dd   = String(d.getUTCDate()).padStart(2, '0')
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  const hh   = String(d.getUTCHours()).padStart(2, '0')
  const mn   = String(d.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} · ${hh}:${mn}`
}

export function formatActivityDateTimeLong(iso: string): string {
  const d = new Date(iso)
  const datePart = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(d)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mn = String(d.getUTCMinutes()).padStart(2, '0')
  return `${datePart} · ${hh}:${mn}`
}
