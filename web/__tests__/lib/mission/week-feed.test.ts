import { buildWeekFeed } from '@/lib/mission/week-feed'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { PlannedSession } from '@/types/plan'
import type { WeekAdvice } from '@/lib/mission/session-advisor'

const weekDates = ['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12','2026-06-13','2026-06-14']

function act(id: string, day: string, sport = 'Run', km = 10): ActivityRow {
  return {
    id, name: id, sport_type: sport, start_time: `${day}T08:00:00Z`, ces: 0,
    avg_hr: null, max_hr: null, distance_m: km * 1000, elevation_gain_m: 100, moving_time_sec: 3000,
    manual_sport_type: null, manual_intensity: null, manual_workout_type: null,
    manual_distance_m: null, manual_moving_time_sec: null, manual_elevation_gain_m: null,
  } as ActivityRow
}

const emptyAdvice: WeekAdvice = {
  today: { kind: 'rest', reasonCode: 'rest-recovery' },
  byDate: Object.fromEntries(weekDates.map(d => [d, { kind: 'rest', reasonCode: 'rest-recovery' }])),
}

it('jour avec activité → entrée done + catégorie sport', () => {
  const feed = buildWeekFeed({ weekDates, todayISO: '2026-06-11', activities: [act('a','2026-06-08','Ride',20)], planned: [], advice: emptyAdvice })
  const mon = feed.find(f => f.date === '2026-06-08')!
  expect(mon.kind).toBe('done')
  if (mon.kind === 'done') { expect(mon.category).toBe('bike'); expect(mon.km).toBe(20) }
})

it('jour futur planifié → entrée planned', () => {
  const planned: PlannedSession[] = [{
    id: 's1', planId: '', date: '2026-06-13', type: 'sortie_longue', title: 'SL', duration: 120,
    intensity: 2, estimatedCharge: 0, status: 'planned',
  }]
  const feed = buildWeekFeed({ weekDates, todayISO: '2026-06-11', activities: [], planned, advice: emptyAdvice })
  expect(feed.find(f => f.date === '2026-06-13')!.kind).toBe('planned')
})

it('réalisé prime sur planifié le même jour', () => {
  const planned: PlannedSession[] = [{
    id: 's1', planId: '', date: '2026-06-08', type: 'footing', title: 'F', duration: 50,
    intensity: 2, estimatedCharge: 0, status: 'planned',
  }]
  const feed = buildWeekFeed({ weekDates, todayISO: '2026-06-11', activities: [act('a','2026-06-08')], planned, advice: emptyAdvice })
  expect(feed.find(f => f.date === '2026-06-08')!.kind).toBe('done')
})
