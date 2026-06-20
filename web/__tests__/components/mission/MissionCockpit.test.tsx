import { render, screen } from '@testing-library/react'
import { MissionCockpit } from '@/components/mission/MissionCockpit'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { ActivityRow } from '@/components/ui/ActivityCard'

// Le storage plan touche Supabase côté client → mock complet.
// pickActiveMacrocycle est importé par weekly-target.ts → doit être dans le mock.
jest.mock('@/lib/plan/storage', () => ({
  getAllMacrocycles: jest.fn().mockResolvedValue([]),
  getPlannedSessions: jest.fn().mockResolvedValue([]),
  isRaceMirrorSession: () => false,
  pickActiveMacrocycle: () => null,
}))
jest.mock('@/lib/hooks/useMorningReportSeen', () => ({
  useMorningReportSeen: () => ({ seen: true }),
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/components/charts/CockpitCumulChart', () => ({
  CockpitCumulChart: () => <div data-testid="cumul-chart" />,
}))

function act(p: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: 'a1', name: 'Sortie longue', sport_type: 'TrailRun',
    start_time: '2026-06-09T06:00:00.000Z',
    ces: 80, avg_hr: null, max_hr: null,
    distance_m: 14200, elevation_gain_m: 620, moving_time_sec: 5880,
    computed_intensity: null,
    manual_intensity: null, manual_sport_type: null, manual_workout_type: null,
    manual_distance_m: null, manual_elevation_gain_m: null, manual_moving_time_sec: null,
    ...p,
  }
}

const weekActivities: ActivityRow[] = [
  act({ id: 'w1', name: 'Trail du Salève' }),
  act({ id: 'w2', name: 'Footing matin', distance_m: 8000, elevation_gain_m: 150 }),
]

function overview(partial: Record<string, unknown> = {}) {
  return {
    weekKm: 28, weekDPlus: 1240, weekSessions: 3,
    dailyKm: [10, 0, 8, 0, 0, 0, 0], dailyDPlus: [], dailyDurationSec: [3600, 0, 2400, 0, 0, 0, 0],
    // Production shape: dailyLabels contains first activity name of the day, NOT day letters.
    dailyLabels: ['Sortie longue', '', 'Côtes', '', '', '', ''],
    ytdKm: 0, ytdDPlus: 0, ytdSessions: 0, monthlyKm: [], monthlyDPlus: [],
    atl: 0, ctl: 0, tsb: 0, weekCes: 0, last7Tsb: [],
    weeklyPoints: [
      { weekLabel: 'S-2', km: 30, dPlus: 0 },
      { weekLabel: 'S-1', km: 40, dPlus: 0 },
      { weekLabel: 'S', km: 28, dPlus: 0 },
    ],
    cumulMonths: [{ label: 'Juin', color: '#FF7900', dailyCumul: [5, 12, 20] }],
    cumulYears: [], workoutTypeBreakdown: [], dailyHistory: [],
    ...partial,
  }
}

const overviews = { run: overview(), ride: overview(), swim: overview(), all: overview() } as never

it('rend le héros semaine (km + D+), le bouton Objectif et les sessions', async () => {
  const { container } = render(
    <I18nProvider initialLang="fr">
      <MissionCockpit sportOverviews={overviews} freshnessPayload={null} discipline={null} weekActivities={weekActivities} />
    </I18nProvider>,
  )
  expect(await screen.findByText('Ma semaine')).toBeInTheDocument()
  expect(screen.getByText('28')).toBeInTheDocument()
  expect(screen.getByText('Objectif')).toBeInTheDocument()
  // Les lettres des jours (L M M J V S D) doivent apparaître, pas les noms d'activités.
  expect(screen.getAllByText('L').length).toBeGreaterThanOrEqual(1)
  expect(screen.queryByText('Sortie longue')).not.toBeInTheDocument()
  // 7 pastilles présentes
  expect(container.querySelectorAll('[data-state]').length).toBe(7)
})

it('affiche les sessions de la semaine et le chart cumul', async () => {
  render(
    <I18nProvider initialLang="fr">
      <MissionCockpit sportOverviews={overviews} freshnessPayload={null} discipline={null} weekActivities={weekActivities} />
    </I18nProvider>,
  )
  expect(await screen.findByText('Sessions de la semaine')).toBeInTheDocument()
  expect(screen.getByText('Trail du Salève')).toBeInTheDocument()
  expect(screen.getByTestId('cumul-chart')).toBeInTheDocument()
  expect(screen.queryByText(/Altitude/)).toBeNull()
})

it('triathlon → volume en heures avec répartition', async () => {
  render(
    <I18nProvider initialLang="fr">
      <MissionCockpit sportOverviews={overviews} freshnessPayload={null} discipline="triathlon" weekActivities={[]} />
    </I18nProvider>,
  )
  // 3 sports × 6000 s/semaine chacun = 18000 s = 5h
  expect(await screen.findByText('5h')).toBeInTheDocument()
})

it('pastille upcoming si séance planifiée demain (si demain est dans la semaine)', async () => {
  // Calcule si demain est encore dans la semaine ISO courante (lundi–dimanche).
  const now = new Date()
  const dow = now.getDay() || 7  // 1=lundi … 7=dimanche
  const hasTomorrowThisWeek = dow < 7  // dimanche = dernier jour, pas de demain cette semaine

  if (!hasTomorrowThisWeek) return  // tolérance : dimanche → test skippé

  // ISO de demain
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const tomorrowISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  const planStorage = await import('@/lib/plan/storage')
  const getPlannedSessions = planStorage.getPlannedSessions as unknown as jest.Mock
  getPlannedSessions.mockResolvedValueOnce([
    { id: 'test-1', date: tomorrowISO, sport: 'run', workoutType: 'endurance', durationMin: 60, isRaceMirror: false },
  ])

  const { container } = render(
    <I18nProvider initialLang="fr">
      <MissionCockpit sportOverviews={overviews} freshnessPayload={null} discipline={null} weekActivities={[]} />
    </I18nProvider>,
  )

  // Attendre que l'effet async soit terminé (planned est chargé).
  await screen.findByText('Ma semaine')
  // Donne le temps à setPlanned de s'appliquer (effet asynchrone).
  await new Promise(r => setTimeout(r, 0))

  expect(container.querySelectorAll('[data-state="upcoming"]').length).toBe(1)
})
