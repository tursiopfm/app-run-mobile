import { render, screen } from '@testing-library/react'
import { ActivitySplits } from '@/components/ui/ActivitySplits'
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

const splits: StravaSplit[] = [
  makeSplit({ split: 1, moving_time: 330, distance: 1000, elevation_difference: 3 }),
  makeSplit({ split: 2, moving_time: 360, distance: 1000, elevation_difference: -2 }),
  makeSplit({ split: 3, moving_time: 345, distance: 1000, elevation_difference: 0 }),
]

// avgPaceSec = 345 sec/km
const AVG_PACE = 345

describe('ActivitySplits', () => {
  it('renders one row per split', () => {
    renderWithI18n(<ActivitySplits splits={splits} avgPaceSec={AVG_PACE} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('formats pace correctly', () => {
    renderWithI18n(<ActivitySplits splits={splits} avgPaceSec={AVG_PACE} />)
    // split 1: 330 sec/km → 5:30 (no /km suffix)
    expect(screen.getByText('5:30')).toBeInTheDocument()
    // split 2: 360 sec/km → 6:00
    expect(screen.getByText('6:00')).toBeInTheDocument()
    // split 3: 345 sec/km → 5:45
    expect(screen.getByText('5:45')).toBeInTheDocument()
  })

  it('shows ↑Xm for positive elevation, ↓Xm for negative, nothing for 0', () => {
    renderWithI18n(<ActivitySplits splits={splits} avgPaceSec={AVG_PACE} />)
    expect(screen.getByText('↑3m')).toBeInTheDocument()
    expect(screen.getByText('↓2m')).toBeInTheDocument()
    // elevation 0 should not appear
    expect(screen.queryByText('↑0m')).not.toBeInTheDocument()
    expect(screen.queryByText('↓0m')).not.toBeInTheDocument()
  })

  it('shows km label as split number', () => {
    renderWithI18n(<ActivitySplits splits={splits} avgPaceSec={AVG_PACE} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
