import { render, screen } from '@testing-library/react'
import { SessionEditorModal } from '@/components/plan/SessionEditorModal'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { SessionTemplate } from '@/types/plan'

jest.mock('@/lib/plan/storage', () => ({
  savePlannedSession: jest.fn().mockResolvedValue(undefined),
  deletePlannedSession: jest.fn().mockResolvedValue(undefined),
  getCurrentPlan: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/plan/use-activity-types', () => ({
  useActivityTypes: () => ({ visibleTypes: [], types: [] }),
}))

const TPL: SessionTemplate = {
  id: 'tpl-vma', title: 'VMA 10×400m', type: 'fractionne',
  defaultDuration: 45, defaultDistance: 8,
  defaultIntensity: 5, description: 'Séance VMA', tags: ['vma'],
}

function wrap(ui: React.ReactElement) {
  return <I18nProvider initialLang="fr">{ui}</I18nProvider>
}

describe('<SessionEditorModal> prefillTemplate', () => {
  it('without prefillTemplate, opens with empty default draft', () => {
    render(wrap(
      <SessionEditorModal
        session={null} initialDate="2026-05-13" open
        onClose={() => {}} onSaved={() => {}}
      />
    ))
    expect(screen.queryByText(/Pré-rempli depuis/)).toBeNull()
    const titleInput = screen.getByRole('textbox', { name: /Titre/i }) as HTMLInputElement
    expect(titleInput.value).toBe('')
  })

  it('with prefillTemplate, prefills fields and shows the banner', () => {
    render(wrap(
      <SessionEditorModal
        session={null} initialDate="2026-05-13" open
        prefillTemplate={TPL}
        onClose={() => {}} onSaved={() => {}}
      />
    ))
    expect(screen.getByText(/Pré-rempli depuis/)).toHaveTextContent('VMA 10×400m')
    const titleInput = screen.getByRole('textbox', { name: /Titre/i }) as HTMLInputElement
    expect(titleInput.value).toBe('VMA 10×400m')
  })

  it('with both session AND prefillTemplate, session wins (edit mode)', () => {
    render(wrap(
      <SessionEditorModal
        session={{
          id: 's1', planId: 'p1', date: '2026-05-13', type: 'footing',
          title: 'Mon footing', duration: 60, intensity: 1,
          estimatedCharge: 48, status: 'planned',
        }}
        open
        prefillTemplate={TPL}
        onClose={() => {}} onSaved={() => {}}
      />
    ))
    expect(screen.queryByText(/Pré-rempli depuis/)).toBeNull()
    const titleInput = screen.getByRole('textbox', { name: /Titre/i }) as HTMLInputElement
    expect(titleInput.value).toBe('Mon footing')
  })
})
