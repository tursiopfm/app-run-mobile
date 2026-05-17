import { render, screen, fireEvent } from '@testing-library/react'
import { PaceField } from '@/components/plan/PaceField'

describe('<PaceField>', () => {
  it('displays formatted pace from secPerKm', () => {
    render(<PaceField value={330} onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('5:30')
  })

  it('emits parsed secPerKm on valid input', () => {
    const onChange = jest.fn()
    render(<PaceField value={null} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '4:30' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(270)
  })

  it('emits null on invalid input', () => {
    const onChange = jest.fn()
    render(<PaceField value={null} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
