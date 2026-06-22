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

it('clic sur le bouton ravito ne déclenche pas onSelectIndex', () => {
  const onSelectIndex = jest.fn()
  render(<WaypointsTable waypoints={rows} onChange={() => {}} selectedIndex={null} onSelectIndex={onSelectIndex} />)
  // The ravito button on Ravito 1 shows the 'L' chip (liquid supply)
  // aria-label="Modifier les ravitos" buttons: first is Départ (index 0), second is Ravito 1 (index 1)
  const ravButtons = screen.getAllByRole('button', { name: /modifier les ravitos/i })
  fireEvent.click(ravButtons[1])
  expect(onSelectIndex).not.toHaveBeenCalled()
})

it('clic sur le bouton × (supprimer) ne déclenche pas onSelectIndex', () => {
  const onSelectIndex = jest.fn()
  render(
    <WaypointsTable
      waypoints={rows}
      onChange={() => {}}
      selectedIndex={null}
      onSelectIndex={onSelectIndex}
      editLines={true}
    />
  )
  // There are two delete buttons; click the one for Ravito 1 (index 1)
  const delButtons = screen.getAllByRole('button', { name: /supprimer la ligne/i })
  fireEvent.click(delButtons[1])
  expect(onSelectIndex).not.toHaveBeenCalled()
})
