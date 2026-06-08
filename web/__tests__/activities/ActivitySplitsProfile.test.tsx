import { render, screen } from '@testing-library/react'
import { ActivitySplitsProfile } from '@/components/ui/ActivitySplitsProfile'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { StravaSplit } from '@/lib/activities/detail'

const renderWithI18n = (ui: React.ReactElement) =>
  render(<I18nProvider initialLang="fr">{ui}</I18nProvider>)

const makeSplit = (overrides: Partial<StravaSplit> & { split: number }): StravaSplit => ({
  distance: 1000,
  elapsed_time: 360,
  moving_time: 330,
  elevation_difference: 0,
  average_speed: 3.0,
  pace_zone: 2,
  ...overrides,
})

// fastest = split 1 (5:30), slowest = split 2 (6:00 + big climb)
const splits: StravaSplit[] = [
  makeSplit({ split: 1, moving_time: 330, elevation_difference: 4 }),
  makeSplit({ split: 2, moving_time: 575, elevation_difference: 84 }),
  makeSplit({ split: 3, moving_time: 345, elevation_difference: -2 }),
]
const AVG = 374

describe('ActivitySplitsProfile', () => {
  it('renders the best pace and the three callouts', () => {
    renderWithI18n(<ActivitySplitsProfile splits={splits} avgPaceSec={AVG} />)
    expect(screen.getByText('★ Meilleur 5:30')).toBeInTheDocument()
    expect(screen.getByText('⚡ Plus rapide')).toBeInTheDocument()
    expect(screen.getByText('⛰ Plus lent')).toBeInTheDocument()
    expect(screen.getByText('📊 Régularité')).toBeInTheDocument()
    // slowest callout references the climb km + its elevation gain
    expect(screen.getByText('km 2 · +84 m')).toBeInTheDocument()
  })

  it('returns null when there are fewer than 2 valid splits', () => {
    const { container } = renderWithI18n(
      <ActivitySplitsProfile splits={[makeSplit({ split: 1 })]} avgPaceSec={AVG} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a flat, uniform run (no pace spread, no elevation) without throwing', () => {
    const flat: StravaSplit[] = [
      makeSplit({ split: 1, moving_time: 360, elevation_difference: 0 }),
      makeSplit({ split: 2, moving_time: 360, elevation_difference: 0 }),
      makeSplit({ split: 3, moving_time: 360, elevation_difference: 0 }),
    ]
    renderWithI18n(<ActivitySplitsProfile splits={flat} avgPaceSec={360} />)
    expect(screen.getByText('±0s')).toBeInTheDocument()
  })
})
