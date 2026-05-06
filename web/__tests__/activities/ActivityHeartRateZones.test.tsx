import { render, screen } from '@testing-library/react'
import { ActivityHeartRateZones } from '@/components/ui/ActivityHeartRateZones'

const AVG_HR = 150
const MAX_HR = 185
const MOVING_TIME = 3600

describe('ActivityHeartRateZones', () => {
  it('renders 5 zone rows', () => {
    render(<ActivityHeartRateZones avgHr={AVG_HR} maxHr={MAX_HR} movingTimeSec={MOVING_TIME} />)
    expect(screen.getByText('Z1 Récup')).toBeInTheDocument()
    expect(screen.getByText('Z2 Aérobie')).toBeInTheDocument()
    expect(screen.getByText('Z3 Tempo')).toBeInTheDocument()
    expect(screen.getByText('Z4 Seuil')).toBeInTheDocument()
    expect(screen.getByText('Z5 VO2max')).toBeInTheDocument()
  })

  it('shows avgHr and maxHr in the header', () => {
    render(<ActivityHeartRateZones avgHr={AVG_HR} maxHr={MAX_HR} movingTimeSec={MOVING_TIME} />)
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('185')).toBeInTheDocument()
  })

  it('renders zone labels Z1 Récup and Z3 Tempo', () => {
    render(<ActivityHeartRateZones avgHr={AVG_HR} maxHr={MAX_HR} movingTimeSec={MOVING_TIME} />)
    expect(screen.getByText('Z1 Récup')).toBeInTheDocument()
    expect(screen.getByText('Z3 Tempo')).toBeInTheDocument()
  })

  it('shows a non-dash duration for at least one zone', () => {
    render(<ActivityHeartRateZones avgHr={AVG_HR} maxHr={MAX_HR} movingTimeSec={MOVING_TIME} />)
    const durations = screen.queryAllByText(/\d+min|\dh\d+/)
    expect(durations.length).toBeGreaterThan(0)
  })
})
