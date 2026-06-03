import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ActivityFractionneSplits } from '@/components/ui/ActivityFractionneSplits'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { StravaLap } from '@/lib/activities/detail'

const renderFr = (ui: React.ReactElement) =>
  render(<I18nProvider initialLang="fr">{ui}</I18nProvider>)

function makeLap(overrides: Partial<StravaLap> & { split: number }): StravaLap {
  return {
    id: overrides.split * 100,
    name: `Lap ${overrides.split}`,
    elapsed_time: 600,
    moving_time: 600,
    distance: 1000,
    average_speed: 1000 / 600,
    total_elevation_gain: 0,
    lap_index: overrides.split - 1,
    ...overrides,
  }
}

// warm-up / fast / short recovery / fast / cool-down → 2 efforts, 1 recovery
const workoutLaps: StravaLap[] = [
  makeLap({ split: 1, distance: 3360, moving_time: 1187, average_speed: 3360 / 1187 }),
  makeLap({ split: 2, distance: 3080, moving_time: 922,  average_speed: 3080 / 922 }),
  makeLap({ split: 3, distance: 220,  moving_time: 182,  average_speed: 220 / 182 }),
  makeLap({ split: 4, distance: 3080, moving_time: 930,  average_speed: 3080 / 930 }),
  makeLap({ split: 5, distance: 1920, moving_time: 736,  average_speed: 1920 / 736 }),
]

// Uniform laps: no fast blocks
const uniformLaps: StravaLap[] = [
  makeLap({ split: 1, average_speed: 2.5 }),
  makeLap({ split: 2, average_speed: 2.5 }),
  makeLap({ split: 3, average_speed: 2.5 }),
]

describe('ActivityFractionneSplits', () => {
  it('shows the detected workout structure label', () => {
    renderFr((<ActivityFractionneSplits laps={workoutLaps} />))
    // 2 efforts of ~3 080 m → rounded to 3 100 m
    expect(screen.getByText('2 × 3 100 m')).toBeInTheDocument()
  })

  it('labels warm-up and cool-down phases', () => {
    renderFr((<ActivityFractionneSplits laps={workoutLaps} />))
    expect(screen.getByText('Échauffement')).toBeInTheDocument()
    expect(screen.getByText('Retour au calme')).toBeInTheDocument()
  })

  it('shows the main set with the number of efforts', () => {
    renderFr((<ActivityFractionneSplits laps={workoutLaps} />))
    expect(screen.getByText('Bloc principal · 2 efforts')).toBeInTheDocument()
  })

  it('shows recovery rows in the expanded detail', () => {
    renderFr((<ActivityFractionneSplits laps={workoutLaps} />))
    // recovery row appears in the expanded detail (e.g. "récup 220 m")
    expect(screen.getByText(/récup 220 m/)).toBeInTheDocument()
  })

  it('copy button is enabled when an interval session is detected', () => {
    renderFr((<ActivityFractionneSplits laps={workoutLaps} />))
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('copy button is disabled for a steady run (no efforts)', () => {
    renderFr((<ActivityFractionneSplits laps={uniformLaps} />))
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('copies the effort times (mm:ss) to clipboard on click', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    renderFr((<ActivityFractionneSplits laps={workoutLaps} />))
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      // effort 1 = 922 s → 15:22, effort 2 = 930 s → 15:30
      expect(writeText).toHaveBeenCalledWith('15:22/15:30')
    })
  })

  it('shows "Copié !" feedback after successful copy', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    renderFr((<ActivityFractionneSplits laps={workoutLaps} />))
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copié !')
    })
  })

  it('shows "Impossible de copier" on clipboard failure', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('Permission denied'))
    Object.assign(navigator, { clipboard: { writeText } })

    renderFr((<ActivityFractionneSplits laps={workoutLaps} />))
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Impossible de copier')
    })
  })
})
