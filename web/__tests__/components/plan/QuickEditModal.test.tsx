import { render, screen, fireEvent } from '@testing-library/react'
import { QuickEditModal } from '@/components/plan/QuickEditModal'

it('bloque une valeur invalide et enregistre une valeur valide', () => {
  const onSave = jest.fn()
  const onClose = jest.fn()
  render(
    <QuickEditModal
      open
      title="Objectif"
      initial="35h00"
      validate={(r) => /^\d{1,2}h\d{2}$/.test(r)}
      onSave={onSave}
      onClose={onClose}
    />,
  )
  const input = screen.getByDisplayValue('35h00')

  // invalide → pas de save, message d'erreur
  fireEvent.change(input, { target: { value: 'abc' } })
  fireEvent.click(screen.getByText('Enregistrer'))
  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByText('Valeur invalide.')).toBeInTheDocument()

  // valide → save + close
  fireEvent.change(input, { target: { value: '36h30' } })
  fireEvent.click(screen.getByText('Enregistrer'))
  expect(onSave).toHaveBeenCalledWith('36h30')
  expect(onClose).toHaveBeenCalled()
})

it('ne rend rien quand fermé', () => {
  const { container } = render(
    <QuickEditModal open={false} title="X" initial="" validate={() => true} onSave={() => {}} onClose={() => {}} />,
  )
  expect(container).toBeEmptyDOMElement()
})
