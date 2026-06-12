import { render, screen, fireEvent } from '@testing-library/react'
import { TableActionsMenu } from '@/components/plan/TableActionsMenu'

it('ouvre le menu et déclenche les actions (export = action directe, sans sous-menu)', () => {
  const onEditRace = jest.fn()
  const onExport = jest.fn()
  render(
    <TableActionsMenu
      onEditRace={onEditRace}
      onEditLines={() => {}}
      onReimport={() => {}}
      onExport={onExport}
    />,
  )

  // fermé au départ
  expect(screen.queryByText('Modifier la course')).not.toBeInTheDocument()

  fireEvent.click(screen.getByLabelText('Actions de la course'))
  expect(screen.getByText('Modifier la course')).toBeInTheDocument()

  // « Exporter » est une action directe (plus de sous-menu PDF/Image/Partager)
  expect(screen.queryByText('Image')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Exporter'))
  expect(onExport).toHaveBeenCalledTimes(1)

  // un item ferme le menu : on rouvre puis on déclenche Modifier la course
  fireEvent.click(screen.getByLabelText('Actions de la course'))
  fireEvent.click(screen.getByText('Modifier la course'))
  expect(onEditRace).toHaveBeenCalled()
})

it('sans tableau, seul « Modifier la course » est proposé', () => {
  render(
    <TableActionsMenu
      hasTableau={false}
      onEditRace={() => {}}
      onEditLines={() => {}}
      onReimport={() => {}}
      onExport={() => {}}
    />,
  )
  fireEvent.click(screen.getByLabelText('Actions de la course'))
  expect(screen.getByText('Modifier la course')).toBeInTheDocument()
  expect(screen.queryByText('Modifier les lignes')).not.toBeInTheDocument()
  expect(screen.queryByText('Ré-importer')).not.toBeInTheDocument()
  expect(screen.queryByText('Exporter')).not.toBeInTheDocument()
})
