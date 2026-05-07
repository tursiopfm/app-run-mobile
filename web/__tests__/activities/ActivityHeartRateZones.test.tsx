import { render, screen } from '@testing-library/react'
import { ActivityHeartRateZones } from '@/components/ui/ActivityHeartRateZones'

const AVG_HR = 150
const MAX_HR = 185
const MOVING_TIME = 3600

describe('ActivityHeartRateZones', () => {
  it('renders 5 zone rows', () => {
    render(<ActivityHeartRateZones avgHr={AVG_HR} maxHr={MAX_HR} movingTimeSec={MOVING_TIME} />)
    expect(screen.getByText(/Récupération/)).toBeInTheDocument()
    expect(screen.getByText(/Endurance active/)).toBeInTheDocument()
    expect(screen.getByText(/Tempo/)).toBeInTheDocument()
    expect(screen.getByText(/Seuil/)).toBeInTheDocument()
    expect(screen.getByText(/VO₂max/)).toBeInTheDocument()
  })

  it('shows avgHr and maxHr in the header', () => {
    render(<ActivityHeartRateZones avgHr={AVG_HR} maxHr={MAX_HR} movingTimeSec={MOVING_TIME} />)
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('185')).toBeInTheDocument()
  })

  it('shows a non-dash duration for at least one zone', () => {
    render(<ActivityHeartRateZones avgHr={AVG_HR} maxHr={MAX_HR} movingTimeSec={MOVING_TIME} />)
    const durations = screen.queryAllByText(/\d+min|\dh\d+/)
    expect(durations.length).toBeGreaterThan(0)
  })

  it('uses profile zones when athleteProfile is provided', () => {
    render(
      <ActivityHeartRateZones
        avgHr={AVG_HR}
        maxHr={MAX_HR}
        movingTimeSec={MOVING_TIME}
        athleteProfile={{ max_hr: 190, threshold_hr: 170, aerobic_threshold_hr: 148, resting_hr: 45 }}
      />
    )
    expect(screen.getByText(/Récupération/)).toBeInTheDocument()
  })
})
