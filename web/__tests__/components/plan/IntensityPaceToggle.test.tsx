import { render, screen, fireEvent } from '@testing-library/react'
import { IntensityPaceToggle } from '@/components/plan/IntensityPaceToggle'

describe('IntensityPaceToggle', () => {
  it('disabled=true : bouton Allure grisé et non cliquable', () => {
    const onChange = jest.fn()
    render(<IntensityPaceToggle value="level" onChange={onChange} disabled />)
    const pace = screen.getByRole('tab', { name: 'Allure' })
    expect(pace).toBeDisabled()
    fireEvent.click(pace)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disabled=true + value="pace" : appelle onChange("level") au mount', () => {
    const onChange = jest.fn()
    render(<IntensityPaceToggle value="pace" onChange={onChange} disabled />)
    expect(onChange).toHaveBeenCalledWith('level')
  })

  it('disabled=false : Allure cliquable (comportement actuel)', () => {
    const onChange = jest.fn()
    render(<IntensityPaceToggle value="level" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Allure' }))
    expect(onChange).toHaveBeenCalledWith('pace')
  })
})
