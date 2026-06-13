import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MissionPlan } from '@/components/mission/MissionPlan'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import {
  getAllMacrocycles, getPlannedSessions, getMainRace, savePlannedSession,
} from '@/lib/plan/storage'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { PlannedSession } from '@/types/plan'

jest.mock('@/lib/plan/storage', () => ({
  getAllMacrocycles: jest.fn(),
  getPlannedSessions: jest.fn(),
  getMainRace: jest.fn(),
  pickActiveMacrocycle: () => null,
  isRaceMirrorSession: () => false,
  savePlannedSession: jest.fn(),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
// Les modales (hooks/portails) ne sont pas le sujet de ces tests.
jest.mock('@/components/plan/SessionAddSheet', () => ({ SessionAddSheet: () => null }))
jest.mock('@/components/plan/SessionEditorModal', () => ({ SessionEditorModal: () => null }))
jest.mock('@/components/plan/RaceEditorModal', () => ({ RaceEditorModal: () => null }))

const mockGetMacros = getAllMacrocycles as jest.Mock
const mockGetPlanned = getPlannedSessions as jest.Mock
const mockGetRace = getMainRace as jest.Mock
const mockSave = savePlannedSession as jest.Mock

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetMacros.mockResolvedValue([])
  mockGetPlanned.mockResolvedValue([])
  mockGetRace.mockResolvedValue(null)
  mockSave.mockResolvedValue(undefined)
})

function renderPlan(recentActivities: ActivityRow[] = []) {
  return render(
    <I18nProvider initialLang="fr">
      <MissionPlan freshnessPayload={null} recentActivities={recentActivities} hrZones={[]} />
    </I18nProvider>,
  )
}

function act(id: string, dayISO: string, km = 12): ActivityRow {
  return {
    id, name: 'Sortie test', sport_type: 'Run', start_time: `${dayISO}T08:00:00Z`, ces: 0,
    avg_hr: null, max_hr: null, distance_m: km * 1000, elevation_gain_m: 200, moving_time_sec: 3600,
    manual_sport_type: null, manual_intensity: null, manual_workout_type: null,
    manual_distance_m: null, manual_moving_time_sec: null, manual_elevation_gain_m: null,
  } as ActivityRow
}

it('sans course : affiche le bloc Ton rythme + le CTA création', async () => {
  renderPlan()
  expect(await screen.findByText(/Ton rythme/)).toBeInTheDocument()
  expect(screen.getByText(/Choisir une course objectif/)).toBeInTheDocument()
})

it('affiche le titre Ma semaine et le bouton Ajouter une séance', async () => {
  renderPlan()
  expect(await screen.findByText('Ma semaine')).toBeInTheDocument()
  expect(screen.getByText(/Ajouter une séance/)).toBeInTheDocument()
})

it('activité réalisée aujourd’hui → héros « faite » + ligne semaine liée à l’activité', async () => {
  renderPlan([act('a1', todayISO(), 14)])
  expect(await screen.findByText(/faite/)).toBeInTheDocument()
  // La ligne réalisée du fil pointe vers le détail de l'activité.
  const links = document.querySelectorAll('a[href="/activities/a1"]')
  expect(links.length).toBeGreaterThan(0)
})

it('séance planifiée aujourd’hui → « Je l’ai faite » marque la séance completed', async () => {
  const planned: PlannedSession[] = [{
    id: 'p1', planId: '', date: todayISO(), type: 'seuil_tempo', title: 'Ma séance test',
    duration: 60, intensity: 4, estimatedCharge: 0, status: 'planned',
  }]
  mockGetPlanned.mockResolvedValue(planned)
  renderPlan()
  const btn = await screen.findByText(/Je l’ai faite/)
  fireEvent.click(btn)
  await waitFor(() => expect(mockSave).toHaveBeenCalled())
  expect(mockSave.mock.calls[0][0]).toMatchObject({ id: 'p1', status: 'completed' })
})
