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

it('supprime une ligne puis Annuler (barre d’édition) la restaure', () => {
  render(<Harness />)
  expect(screen.getByDisplayValue('Ravito B')).toBeInTheDocument()
  // Pas de bouton Annuler tant que rien n'est supprimé.
  expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()

  const delButtons = screen.getAllByLabelText('Supprimer la ligne')
  fireEvent.click(delButtons[1]) // ligne du milieu

  expect(screen.queryByDisplayValue('Ravito B')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Annuler/ }))

  expect(screen.getByDisplayValue('Ravito B')).toBeInTheDocument()
  // Pile vide → le bouton disparaît.
  expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()
})

it('plusieurs suppressions s’annulent en chaîne (LIFO)', () => {
  render(<Harness />)
  const delButtons = screen.getAllByLabelText('Supprimer la ligne')
  fireEvent.click(delButtons[1]) // supprime Ravito B
  // Après reindex il reste 2 lignes ; supprime la nouvelle ligne du milieu impossible → supprime l'index 1 (Arrivée reclassée)
  fireEvent.click(screen.getAllByLabelText('Supprimer la ligne')[1])

  fireEvent.click(screen.getByRole('button', { name: /Annuler/ }))
  fireEvent.click(screen.getByRole('button', { name: /Annuler/ }))

  expect(screen.getByDisplayValue('Ravito B')).toBeInTheDocument()
  expect(screen.getByDisplayValue('Arrivée')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()
})
