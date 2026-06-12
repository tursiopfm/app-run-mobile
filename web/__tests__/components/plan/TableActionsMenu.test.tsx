import { render, screen, fireEvent } from '@testing-library/react'
import { TableActionsMenu } from '@/components/plan/TableActionsMenu'

it('ouvre le menu, déclenche le sous-menu export et les actions', () => {
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

  fireEvent.click(screen.getByLabelText('Actions du tableau'))
  expect(screen.getByText('Modifier la course')).toBeInTheDocument()

  // sous-menu export
  fireEvent.click(screen.getByText('Exporter'))
  fireEvent.click(screen.getByText('JPEG'))
  expect(onExport).toHaveBeenCalledWith('jpeg')

  // un item ferme le menu : on rouvre puis on déclenche Modifier la course
  fireEvent.click(screen.getByLabelText('Actions du tableau'))
  fireEvent.click(screen.getByText('Modifier la course'))
  expect(onEditRace).toHaveBeenCalled()
})
