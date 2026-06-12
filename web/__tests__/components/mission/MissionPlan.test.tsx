import { render, screen } from '@testing-library/react'
import { MissionPlan } from '@/components/mission/MissionPlan'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

jest.mock('@/lib/plan/storage', () => ({
  getAllMacrocycles: jest.fn().mockResolvedValue([]),
  getPlannedSessions: jest.fn().mockResolvedValue([]),
  getMainRace: jest.fn().mockResolvedValue(null),
  pickActiveMacrocycle: () => null,
  isRaceMirrorSession: () => false,
}))

it('sans plan ni course → Repos + état vide Destination', async () => {
  render(
    <I18nProvider initialLang="fr">
      <MissionPlan />
    </I18nProvider>,
  )
  const repos = await screen.findAllByText('Repos')
  expect(repos.length).toBeGreaterThan(0)
  expect(screen.getByText('Aucune course prévue')).toBeInTheDocument()
  expect(screen.getByText(/Ajouter une course/)).toBeInTheDocument()
  expect(screen.getByText(/Ajuster mon plan/)).toBeInTheDocument()
})
