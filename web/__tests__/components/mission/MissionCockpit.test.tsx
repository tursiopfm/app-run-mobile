import { render, screen } from '@testing-library/react'
import { MissionCockpit } from '@/components/mission/MissionCockpit'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

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

function overview(partial: Record<string, unknown> = {}) {
  return {
    weekKm: 28, weekDPlus: 1240, weekSessions: 3,
    dailyKm: [10, 0, 8, 0, 0, 0, 0], dailyDPlus: [], dailyDurationSec: [3600, 0, 2400, 0, 0, 0, 0],
    dailyLabels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    ytdKm: 0, ytdDPlus: 0, ytdSessions: 0, monthlyKm: [], monthlyDPlus: [],
    atl: 0, ctl: 0, tsb: 0, weekCes: 0, last7Tsb: [],
    weeklyPoints: [
      { weekLabel: 'S-2', km: 30, dPlus: 0 },
      { weekLabel: 'S-1', km: 40, dPlus: 0 },
      { weekLabel: 'S', km: 28, dPlus: 0 },
    ],
    cumulMonths: [], cumulYears: [], workoutTypeBreakdown: [], dailyHistory: [],
    ...partial,
  }
}

const overviews = { run: overview(), ride: overview(), swim: overview(), all: overview() } as never

it('rend le héros semaine (km + D+) et la tendance', async () => {
  render(
    <I18nProvider initialLang="fr">
      <MissionCockpit sportOverviews={overviews} freshnessPayload={null} discipline={null} />
    </I18nProvider>,
  )
  expect(await screen.findByText('Ma semaine')).toBeInTheDocument()
  expect(screen.getByText('28')).toBeInTheDocument()
  expect(screen.getByText(/Altitude/)).toBeInTheDocument()
})

it('triathlon → volume en heures avec répartition', async () => {
  render(
    <I18nProvider initialLang="fr">
      <MissionCockpit sportOverviews={overviews} freshnessPayload={null} discipline="triathlon" />
    </I18nProvider>,
  )
  // 3 sports × 6000 s/semaine chacun = 18000 s = 5h
  expect(await screen.findByText('5h')).toBeInTheDocument()
})
