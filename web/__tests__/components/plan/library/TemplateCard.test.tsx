import { render, screen, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { TemplateCard } from '@/components/plan/library/TemplateCard'
import type { SessionTemplate } from '@/types/plan'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

const TPL: SessionTemplate = {
  id: 'tpl-1', title: 'VMA 10×400m', type: 'fractionne',
  defaultDuration: 45, defaultDistance: 8,
  defaultIntensity: 5, description: 'Séance VMA classique', tags: ['vma'],
}

function wrap(ui: React.ReactElement) {
  return (
    <I18nProvider initialLocale="fr">
      <DndContext>{ui}</DndContext>
    </I18nProvider>
  )
}

describe('<TemplateCard>', () => {
  it('renders title, type label, duration and distance', () => {
    render(wrap(<TemplateCard template={TPL} types={[]} isCustom mode="drag" onClick={() => {}} onDelete={() => {}} />))
    expect(screen.getByText('VMA 10×400m')).toBeInTheDocument()
    expect(screen.getByText('45 min')).toBeInTheDocument()
    expect(screen.getByText('8 km')).toBeInTheDocument()
  })

  it('mode=drag shows delete button and triggers onDelete', () => {
    const onDelete = jest.fn()
    render(wrap(<TemplateCard template={TPL} types={[]} isCustom mode="drag" onClick={() => {}} onDelete={onDelete} />))
    const btn = screen.getByLabelText(/supprimer/i)
    fireEvent.click(btn)
    expect(onDelete).toHaveBeenCalled()
  })

  it('mode=pick hides delete button and clicking calls onClick (no DnD attachment)', () => {
    const onClick = jest.fn()
    render(wrap(<TemplateCard template={TPL} types={[]} isCustom mode="pick" onClick={onClick} onDelete={() => {}} />))
    expect(screen.queryByLabelText(/supprimer/i)).toBeNull()
    fireEvent.click(screen.getByText('VMA 10×400m'))
    expect(onClick).toHaveBeenCalled()
  })
})
