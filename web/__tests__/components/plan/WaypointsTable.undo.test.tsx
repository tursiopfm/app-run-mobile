import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaypointsTable } from '@/components/plan/WaypointsTable'
import type { RaceWaypoint } from '@/types/plan'

type Draft = Omit<RaceWaypoint, 'id' | 'raceId'>

const mk = (name: string, km: number, type: Draft['type']): Draft => ({
  orderIndex: 0, name, km, kmInter: null, dPlus: null, dMoins: null,
  cutoffRaw: null, cutoffKind: null, type, supplies: [], targetOverrideSec: null,
})

function Harness() {
  const [wps, setWps] = useState<Draft[]>([
    mk('Départ', 0, 'depart'),
    mk('Ravito B', 10, 'ravito'),
    mk('Arrivée', 20, 'arrivee'),
  ])
  const [edit, setEdit] = useState(true)
  return (
    <WaypointsTable waypoints={wps} onChange={setWps} editLines={edit} onEditLinesChange={setEdit} />
  )
}

it('supprime une ligne puis Annuler la restaure', () => {
  render(<Harness />)
  expect(screen.getByDisplayValue('Ravito B')).toBeInTheDocument()

  const delButtons = screen.getAllByLabelText('Supprimer la ligne')
  fireEvent.click(delButtons[1]) // ligne du milieu

  expect(screen.queryByDisplayValue('Ravito B')).not.toBeInTheDocument()
  expect(screen.getByText('Ligne supprimée')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

  expect(screen.getByDisplayValue('Ravito B')).toBeInTheDocument()
  expect(screen.queryByText('Ligne supprimée')).not.toBeInTheDocument()
})
