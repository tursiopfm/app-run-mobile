import { render, screen, fireEvent } from '@testing-library/react'
import { TimeEditModal } from '@/components/plan/TimeEditModal'

it('édite heures/minutes et borne les minutes à 59', () => {
  const onSave = jest.fn()
  const onClose = jest.fn()
  render(
    <TimeEditModal open title="Objectif" hours={35} minutes={0} maxHours={99}
      onSave={onSave} onClose={onClose} />,
  )
  expect(screen.getByLabelText('Heures')).toHaveValue('35')
  fireEvent.change(screen.getByLabelText('Heures'), { target: { value: '40' } })
  fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '90' } })
  fireEvent.click(screen.getByText('Enregistrer'))
  expect(onSave).toHaveBeenCalledWith(40, 59)
  expect(onClose).toHaveBeenCalled()
})

it('borne les heures au maximum (horloge 23h)', () => {
  const onSave = jest.fn()
  render(
    <TimeEditModal open title="Départ" hours={19} minutes={0} maxHours={23}
      onSave={onSave} onClose={() => {}} />,
  )
  fireEvent.change(screen.getByLabelText('Heures'), { target: { value: '30' } })
  fireEvent.click(screen.getByText('Enregistrer'))
  expect(onSave).toHaveBeenCalledWith(23, 0)
})

it('ne rend rien quand fermé', () => {
  const { container } = render(
    <TimeEditModal open={false} title="X" hours={0} minutes={0} maxHours={23} onSave={() => {}} onClose={() => {}} />,
  )
  expect(container).toBeEmptyDOMElement()
})
