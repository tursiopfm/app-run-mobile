import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaypointsTable } from '@/components/plan/WaypointsTable'
import type { RaceWaypoint } from '@/types/plan'

type Draft = Omit<RaceWaypoint, 'id' | 'raceId'>

const mk = (name: string, km: number, type: Draft['type']): Draft => ({
  orderIndex: 0, name, km, kmInter: null, dPlus: null, dMoins: null, altitude: null,
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
  expect(screen.queryByRole('button', { name: /Valider/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()
})

it('Valider conserve les modifications', () => {
  render(<Harness />)
  fireEvent.click(screen.getAllByLabelText('Supprimer la ligne')[1])

  fireEvent.click(screen.getByRole('button', { name: /Valider/ }))

  expect(screen.queryByDisplayValue('Ravito B')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Valider/ })).not.toBeInTheDocument()
})

it('le km d’une ligne ajoutée se valide au blur (pas de commit pendant la frappe)', () => {
  render(<Harness />)
  // Ajout : km = milieu (10+20)/2 = 15 → entre Ravito B et Arrivée.
  fireEvent.click(screen.getByRole('button', { name: /Ajouter une ligne/ }))
  const kmInput = screen.getByDisplayValue('15')
  expect(screen.getByDisplayValue('Nouveau point')).toBeInTheDocument()

  // Frappe sans blur : le champ change mais le km n'est pas encore commité.
  fireEvent.change(kmInput, { target: { value: '5' } })
  // Blur : commit + re-tri (la ligne se range entre Départ et Ravito B).
  fireEvent.blur(kmInput)
  expect(screen.getByDisplayValue('5')).toBeInTheDocument()
})
