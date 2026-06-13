import { render, screen } from '@testing-library/react'
import { MissionPlan } from '@/components/mission/MissionPlan'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

jest.mock('@/lib/plan/storage', () => ({
  getAllMacrocycles: jest.fn().mockResolvedValue([]),
  getPlannedSessions: jest.fn().mockResolvedValue([]),
  getMainRace: jest.fn().mockResolvedValue(null),
  pickActiveMacrocycle: () => null,
  isRaceMirrorSession: () => false,
  savePlannedSession: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
// Les modales (lourdes, hooks/portails) ne sont pas le sujet de ce test.
jest.mock('@/components/plan/SessionAddSheet', () => ({ SessionAddSheet: () => null }))
jest.mock('@/components/plan/SessionEditorModal', () => ({ SessionEditorModal: () => null }))

function renderPlan() {
  return render(
    <I18nProvider initialLang="fr">
      <MissionPlan freshnessPayload={null} recentActivities={[]} discipline={null} />
    </I18nProvider>,
  )
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
