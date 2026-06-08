import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { OtpCodeInput } from '@/components/auth/OtpCodeInput'

// Wrapper contrôlé : OtpCodeInput est piloté par value/onChange.
function Harness({ onComplete }: { onComplete?: (c: string) => void }) {
  const [value, setValue] = useState('')
  return <OtpCodeInput value={value} onChange={setValue} onComplete={onComplete} />
}

describe('OtpCodeInput', () => {
  it('rend 6 cases', () => {
    render(<Harness />)
    expect(screen.getAllByRole('textbox')).toHaveLength(6)
  })

  it('saisit chiffre par chiffre et appelle onComplete au 6e', () => {
    const onComplete = jest.fn()
    render(<Harness onComplete={onComplete} />)
    const boxes = screen.getAllByRole('textbox')
    ;['1', '2', '3', '4', '5', '6'].forEach((d, i) => {
      fireEvent.change(boxes[i], { target: { value: d } })
    })
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('accepte un code collé', () => {
    const onComplete = jest.fn()
    render(<Harness onComplete={onComplete} />)
    const boxes = screen.getAllByRole('textbox')
    fireEvent.paste(boxes[0], { clipboardData: { getData: () => '987654' } })
    expect(onComplete).toHaveBeenCalledWith('987654')
  })

  it('ignore les caractères non numériques', () => {
    const onComplete = jest.fn()
    render(<Harness onComplete={onComplete} />)
    const boxes = screen.getAllByRole('textbox')
    fireEvent.paste(boxes[0], { clipboardData: { getData: () => 'ab12cd34ef56' } })
    expect(onComplete).toHaveBeenCalledWith('123456')
  })
})
