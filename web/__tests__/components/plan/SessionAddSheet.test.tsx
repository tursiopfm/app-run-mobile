import { render, screen, fireEvent } from '@testing-library/react'
import { SessionAddSheet } from '@/components/plan/SessionAddSheet'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { SessionTemplate } from '@/types/plan'

jest.mock('@/lib/plan/storage', () => ({
  getCustomTemplates: jest.fn().mockResolvedValue([]),
  getHiddenSystemTemplateIds: jest.fn().mockReturnValue([]),
}))
jest.mock('@/lib/training/session-templates', () => ({
  SESSION_TEMPLATES: [
    {
      id: 'sys-vma', title: 'VMA 10×400m', type: 'fractionne',
      defaultDuration: 45, defaultDistance: 8, defaultIntensity: 5,
      description: 'VMA', tags: ['vma'],
    } as SessionTemplate,
    {
      id: 'sys-sl', title: 'SL 20km', type: 'sortie_longue',
      defaultDuration: 120, defaultDistance: 20, defaultIntensity: 2,
      description: 'Sortie longue', tags: [],
    } as SessionTemplate,
  ],
}))
jest.mock('@/lib/plan/use-activity-types', () => ({
  useActivityTypes: () => ({
    visibleTypes: [
      { slug: 'fractionne', label: 'Fractionné' },
      { slug: 'sortie_longue', label: 'Sortie longue' },
    ],
    types: [
      { id: 't1', slug: 'fractionne', label: 'Fractionné', defaultIntensity: 5, category: 'run', isSystem: true },
      { id: 't2', slug: 'sortie_longue', label: 'Sortie longue', defaultIntensity: 2, category: 'run', isSystem: true },
    ],
  }),
}))

function wrap(ui: React.ReactElement) {
  return <I18nProvider initialLang="fr">{ui}</I18nProvider>
}

describe('<SessionAddSheet>', () => {
  const baseProps = {
    open: true,
    dateISO: '2026-05-13',
    onClose: jest.fn(),
    onPickTemplate: jest.fn(),
    onCreateBlank: jest.fn(),
  }
  beforeEach(() => { jest.clearAllMocks() })

  it('renders header, CTA create, search, pills and template grid', async () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    expect(screen.getByText('Ajouter une séance')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Créer une nouvelle séance/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Rechercher une séance…')).toBeInTheDocument()
    expect(await screen.findByText('VMA 10×400m')).toBeInTheDocument()
    expect(screen.getByText('SL 20km')).toBeInTheDocument()
  })

  it('CTA Créer appelle onCreateBlank', () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    fireEvent.click(screen.getByRole('button', { name: /Créer une nouvelle séance/i }))
    expect(baseProps.onCreateBlank).toHaveBeenCalled()
  })

  it('clic sur un template appelle onPickTemplate avec ce template', async () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    // SessionAddSheet picker uses addPickAria: (title) => `Choisir le template ${title}`
    const card = await screen.findByLabelText(/Choisir le template VMA 10×400m/i)
    fireEvent.click(card)
    expect(baseProps.onPickTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 'sys-vma' }))
  })

  it('touche Échap ferme', () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('clic sur le scrim ferme', () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    // createPortal renders into document.body, not container
    const scrim = document.body.querySelector('[role="dialog"]') as HTMLElement
    fireEvent.click(scrim)
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('search filtre les templates par titre', async () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    await screen.findByText('VMA 10×400m')
    fireEvent.change(screen.getByPlaceholderText('Rechercher une séance…'), { target: { value: 'sl' } })
    expect(screen.queryByText('VMA 10×400m')).toBeNull()
    expect(screen.getByText('SL 20km')).toBeInTheDocument()
  })

  it('aucun résultat → affiche un empty state avec bouton reset', async () => {
    render(wrap(<SessionAddSheet {...baseProps} />))
    await screen.findByText('VMA 10×400m')
    fireEvent.change(screen.getByPlaceholderText('Rechercher une séance…'), { target: { value: 'xyz123' } })
    expect(screen.getByText('Aucune séance ne correspond')).toBeInTheDocument()
    const reset = screen.getByRole('button', { name: /Réinitialiser les filtres/i })
    fireEvent.click(reset)
    expect(await screen.findByText('VMA 10×400m')).toBeInTheDocument()
  })
})
