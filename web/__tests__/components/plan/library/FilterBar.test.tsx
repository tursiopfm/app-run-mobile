import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/components/plan/library/FilterBar'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { ActivityType } from '@/types/activity-types'

const TYPES: ActivityType[] = [
  { id: 't1', slug: 'fractionne', label: 'Fractionné', defaultIntensity: 5, category: 'run', isSystem: true },
  { id: 't2', slug: 'seuil_tempo', label: 'Seuil', defaultIntensity: 4, category: 'run', isSystem: true },
]
const VISIBLE = TYPES.map(t => ({ slug: t.slug, label: t.label }))

function wrap(ui: React.ReactElement) {
  return <I18nProvider initialLang="fr">{ui}</I18nProvider>
}

describe('<FilterBar>', () => {
  it('variant=compact renders all visibleTypes in a single row, no expand toggle, no prefs button', () => {
    render(wrap(
      <FilterBar
        variant="compact"
        visibleTypes={VISIBLE}
        types={TYPES}
        selectedType="all"
        onSelectType={() => {}}
      />
    ))
    expect(screen.getByRole('tab', { name: /Tous/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Fractionné/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Seuil/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /personnalisé/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Afficher/i })).toBeNull()
  })

  it('variant=full renders expand toggle and prefs button', () => {
    render(wrap(
      <FilterBar
        variant="full"
        visibleTypes={VISIBLE}
        types={TYPES}
        selectedType="all"
        filtersExpanded={false}
        onSelectType={() => {}}
        onToggleExpand={() => {}}
        onOpenPrefs={() => {}}
      />
    ))
    expect(screen.getByLabelText(/personnalisé/i)).toBeInTheDocument()
  })

  it('selecting a type pill calls onSelectType with the slug', () => {
    const onSelectType = jest.fn()
    render(wrap(
      <FilterBar
        variant="compact"
        visibleTypes={VISIBLE}
        types={TYPES}
        selectedType="all"
        onSelectType={onSelectType}
      />
    ))
    fireEvent.click(screen.getByRole('tab', { name: /Fractionné/i }))
    expect(onSelectType).toHaveBeenCalledWith('fractionne')
  })
})
