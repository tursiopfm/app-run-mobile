import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { ProchaineSeanceBlock } from '@/components/plan/ProchaineSeanceBlock'
import { BlockContext } from '@/components/blocks/BlockGrid'

jest.mock('@/lib/plan/storage', () => ({
  getAllMacrocycles: jest.fn().mockResolvedValue([]),
  getPlannedSessions: jest.fn().mockResolvedValue([]),
  getMainRace: jest.fn().mockResolvedValue(null),
  pickActiveMacrocycle: () => null,
  isRaceMirrorSession: () => false,
}))
jest.mock('@/components/plan/SessionAddSheet', () => ({ SessionAddSheet: () => null }))
jest.mock('@/components/plan/SessionEditorModal', () => ({ SessionEditorModal: () => null }))
jest.mock('@/components/plan/RaceEditorModal', () => ({ RaceEditorModal: () => null }))

function renderBlock(hideSelf = jest.fn()) {
  render(
    <I18nProvider initialLang="fr">
      <BlockContext.Provider value={{ hideSelf }}>
        <ProchaineSeanceBlock freshnessPayload={null} recentActivities={[]} hrZones={[]} reloadKey={0} onChange={jest.fn()} />
      </BlockContext.Provider>
    </I18nProvider>,
  )
  return hideSelf
}

it('affiche le héros (curseur « Selon ta forme ») une fois chargé', async () => {
  renderBlock()
  expect(await screen.findByText(/Selon ta forme/)).toBeInTheDocument()
})

it('le kebab « Masquer » déclenche hideSelf', async () => {
  const hideSelf = renderBlock()
  await screen.findByText(/Selon ta forme/)
  fireEvent.click(screen.getByLabelText(/menu/i))
  fireEvent.click(screen.getByText('Masquer'))
  expect(hideSelf).toHaveBeenCalled()
})
