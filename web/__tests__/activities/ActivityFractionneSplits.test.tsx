import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ActivityFractionneSplits } from '@/components/ui/ActivityFractionneSplits'
import type { StravaLap } from '@/lib/activities/detail'

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

// Workout laps: echauffement / fast / short recovery / fast / cooldown
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
  it('renders one row per lap (lap numbers 1–5)', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    expect(screen.getAllByText('1')[0]).toBeInTheDocument()
    expect(screen.getAllByText('2')[0]).toBeInTheDocument()
    expect(screen.getAllByText('3')[0]).toBeInTheDocument()
    expect(screen.getAllByText('4')[0]).toBeInTheDocument()
    expect(screen.getAllByText('5')[0]).toBeInTheDocument()
  })

  it('formats distance >= 1000m as km', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    expect(screen.getByText('3.36 km')).toBeInTheDocument()
    expect(screen.getAllByText('3.08 km')).toHaveLength(2)
    expect(screen.getByText('1.92 km')).toBeInTheDocument()
  })

  it('formats distance < 1000m as meters', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    expect(screen.getByText('220 m')).toBeInTheDocument()
  })

  it('formats lap time as mm:ss', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    // lap 2: moving_time=922s → 15:22
    expect(screen.getByText('15:22')).toBeInTheDocument()
    // lap 4: moving_time=930s → 15:30
    expect(screen.getByText('15:30')).toBeInTheDocument()
  })

  it('shows RAPIDE badge on fast laps (2 and 4)', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    const badges = screen.getAllByText('RAPIDE')
    expect(badges).toHaveLength(2)
  })

  it('copy button is enabled when fast laps detected', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    const btn = screen.getByRole('button')
    expect(btn).not.toBeDisabled()
  })

  it('copy button is disabled when no fast laps (uniform pace)', () => {
    render(<ActivityFractionneSplits laps={uniformLaps} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
  })

  it('copies fast lap times (mm:ss) to clipboard on click', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ActivityFractionneSplits laps={workoutLaps} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('15:22\n15:30')
    })
  })

  it('shows "Copié !" feedback after successful copy', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ActivityFractionneSplits laps={workoutLaps} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copié !')
    })
  })

  it('shows "Impossible de copier" on clipboard failure', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('Permission denied'))
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ActivityFractionneSplits laps={workoutLaps} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Impossible de copier')
    })
  })
})
