import { weeklyVolumes, habitualWeekly } from '@/lib/mission/rhythm'
import type { ActivityRow } from '@/components/ui/ActivityCard'

function act(id: string, startTime: string, km: number, dPlus = 0): ActivityRow {
  return {
    id, name: id, sport_type: 'Run', start_time: startTime, ces: 0,
    avg_hr: null, max_hr: null,
    distance_m: km * 1000, elevation_gain_m: dPlus, moving_time_sec: 3600,
    manual_sport_type: null, manual_intensity: null, manual_workout_type: null,
    manual_distance_m: null, manual_moving_time_sec: null, manual_elevation_gain_m: null,
  } as ActivityRow
}

describe('weeklyVolumes', () => {
  it('regroupe par semaine ISO (lundi) et somme km + D+', () => {
    const acts = [
      act('a', '2026-06-01T08:00:00Z', 10, 100), // lundi sem A
      act('b', '2026-06-03T08:00:00Z', 5, 50),   // mercredi sem A
      act('c', '2026-06-09T08:00:00Z', 8, 80),   // mardi sem B
    ]
    const weeks = weeklyVolumes(acts, '2026-06-12', 4)
    expect(weeks).toHaveLength(4)
    const semA = weeks.find(w => w.weekStart === '2026-06-01')!
    expect(semA.km).toBe(15)
    expect(semA.dPlus).toBe(150)
    const semB = weeks.find(w => w.weekStart === '2026-06-08')!
    expect(semB.km).toBe(8)
  })

  it('émet des semaines vides (km=0) sans activité', () => {
    const weeks = weeklyVolumes([], '2026-06-12', 4)
    expect(weeks).toHaveLength(4)
    expect(weeks.every(w => w.km === 0)).toBe(true)
  })
})

describe('habitualWeekly', () => {
  // today = ven 2026-06-12 → semaine courante = lundi 2026-06-08.
  // Les 4 semaines ANTÉRIEURES (exclut la courante) : lundis 05-11, 05-18, 05-25, 06-01.
  it('moyenne les 4 semaines ISO antérieures (zéros inclus), exclut la semaine courante', () => {
    const acts = [
      act('a', '2026-05-11T08:00:00Z', 20), // sem -4
      act('b', '2026-05-18T08:00:00Z', 30), // sem -3
      act('c', '2026-05-25T08:00:00Z', 40), // sem -2
      act('d', '2026-06-01T08:00:00Z', 50), // sem -1
      act('e', '2026-06-11T08:00:00Z', 999), // semaine courante → EXCLUE
    ]
    const h = habitualWeekly(acts, '2026-06-12')
    expect(h.km).toBe(35) // (20+30+40+50)/4
  })

  it('renvoie 0 si aucune activité antérieure (zéros moyennés)', () => {
    expect(habitualWeekly([], '2026-06-12').km).toBe(0)
  })
})
