import { render, screen, fireEvent } from '@testing-library/react'
import { WaypointDetailCard } from '@/components/plan/WaypointDetailCard'
import type { RaceWaypoint } from '@/types/plan'

const wp = (over: Partial<RaceWaypoint> = {}): RaceWaypoint => ({
  id: 'w', raceId: 'r', orderIndex: 0, name: 'Beaufort', km: 92.3, kmInter: null,
  dPlus: 4200, dMoins: 3100, altitude: null, cutoffRaw: '00:30', cutoffKind: 'clock_time',
  type: 'ravito', supplies: ['liquid', 'solid', 'hot', 'base_vie'], targetOverrideSec: null, ...over,
})

describe('WaypointDetailCard', () => {
  it('affiche nom, toutes les puces, tag base vie, et le passage estimé', () => {
    render(
      <WaypointDetailCard
        waypoint={wp()} previous={wp({ name: 'Roselend', dPlus: 3380, dMoins: 1890 })}
        altitude={1100} passageClock="mar. 21:30"
        hasPrev hasNext onPrev={() => {}} onNext={() => {}}
      />,
    )
    expect(screen.getByText('Beaufort')).toBeInTheDocument()
    expect(screen.getByText('Base vie')).toBeInTheDocument()
    expect(screen.getByText('mar. 21:30')).toBeInTheDocument()
    // D+/D− du tronçon depuis Roselend : 4200-3380=820, 3100-1890=1210
    expect(screen.getByText(/\+820/)).toBeInTheDocument()
    expect(screen.getByText(/1\s?210/)).toBeInTheDocument()
    // 4 puces (L S C BV)
    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('BV')).toBeInTheDocument()
  })

  it('barrière et ravito absents → « — »', () => {
    render(
      <WaypointDetailCard
        waypoint={wp({ cutoffRaw: null, supplies: [] })} previous={null}
        altitude={null} passageClock=""
        hasPrev={false} hasNext onPrev={() => {}} onNext={() => {}}
      />,
    )
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('boutons de navigation bornés', () => {
    const onPrev = jest.fn(); const onNext = jest.fn()
    render(
      <WaypointDetailCard
        waypoint={wp()} previous={null} altitude={1100} passageClock=""
        hasPrev={false} hasNext onPrev={onPrev} onNext={onNext}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ravito précédent' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ravito suivant' }))
    expect(onPrev).not.toHaveBeenCalled() // désactivé (hasPrev=false)
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
