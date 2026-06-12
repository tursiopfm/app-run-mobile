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

it('Annuler restaure l’état d’entrée du mode édition (suppression + cellule) et sort du mode', () => {
  render(<Harness />)
  expect(screen.getByDisplayValue('Ravito B')).toBeInTheDocument()

  // Suppression d'une ligne + édition d'un nom pendant le mode édition.
  fireEvent.click(screen.getAllByLabelText('Supprimer la ligne')[1])
  expect(screen.queryByDisplayValue('Ravito B')).not.toBeInTheDocument()
  fireEvent.change(screen.getByDisplayValue('Départ'), { target: { value: 'Départ modifié' } })

  fireEvent.click(screen.getByRole('button', { name: /Annuler/ }))

  // Tout est restauré…
  expect(screen.getByDisplayValue('Ravito B')).toBeInTheDocument()
  expect(screen.getByDisplayValue('Départ')).toBeInTheDocument()
  expect(screen.queryByDisplayValue('Départ modifié')).not.toBeInTheDocument()
  // …et on est sorti du mode édition.
  expect(screen.queryByRole('button', { name: /Terminé/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()
})

it('Terminé conserve les modifications', () => {
  render(<Harness />)
  fireEvent.click(screen.getAllByLabelText('Supprimer la ligne')[1])

  fireEvent.click(screen.getByRole('button', { name: /Terminé/ }))

  expect(screen.queryByDisplayValue('Ravito B')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Terminé/ })).not.toBeInTheDocument()
})
