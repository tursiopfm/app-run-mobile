import { formatActivityDateTime, formatActivityDateTimeLong } from '@/lib/activities/format-datetime'

// start_time stocke l'heure LOCALE de l'activité étiquetée UTC (Strava start_date_local).
// Le formatage doit afficher cette heure-mur telle quelle, sans reconversion fuseau navigateur.
// 07:50:37+00:00 = la sortie a été lancée à 07:50 (local) → on doit afficher 07:50, pas 09:50.
describe('format-datetime — affiche l\'heure-mur stockée (getters UTC)', () => {
  const iso = '2026-06-04T07:50:37+00:00'

  it('formatActivityDateTime → DD/MM/YYYY · HH:MM en UTC', () => {
    expect(formatActivityDateTime(iso)).toBe('04/06/2026 · 07:50')
  })

  it('formatActivityDateTimeLong → date longue FR · HH:MM en UTC', () => {
    expect(formatActivityDateTimeLong(iso)).toBe('4 juin 2026 · 07:50')
  })

  it('minuit ne déborde pas sur un autre jour', () => {
    expect(formatActivityDateTime('2026-06-04T00:15:00+00:00')).toBe('04/06/2026 · 00:15')
  })
})
