import { render, screen, fireEvent } from '@testing-library/react'
import { WaypointsTable } from '@/components/plan/WaypointsTable'
import type { RaceWaypoint } from '@/types/plan'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>
const rows: WP[] = [
  { orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: 0, altitude: null, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null },
  { orderIndex: 1, name: 'Ravito 1', km: 10, kmInter: null, dPlus: 300, dMoins: 50, altitude: null, cutoffRaw: null, cutoffKind: null, type: 'ravito', supplies: ['liquid'], targetOverrideSec: null },
]

it('tap sur une ligne appelle onSelectIndex avec son index', () => {
  const onSelectIndex = jest.fn()
  render(<WaypointsTable waypoints={rows} onChange={() => {}} selectedIndex={null} onSelectIndex={onSelectIndex} />)
  fireEvent.click(screen.getByDisplayValue('Ravito 1'))
  expect(onSelectIndex).toHaveBeenCalledWith(1)
})
