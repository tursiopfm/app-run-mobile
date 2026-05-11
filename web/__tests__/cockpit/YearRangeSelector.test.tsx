import { render, screen, fireEvent } from '@testing-library/react'
import { YearRangeSelector } from '@/components/cockpit/YearRangeSelector'

function setup(partial?: Partial<React.ComponentProps<typeof YearRangeSelector>>) {
  const onChange = jest.fn()
  const utils = render(
    <YearRangeSelector value={5} max={14} onChange={onChange} {...partial} />,
  )
  return { onChange, ...utils }
}

describe('YearRangeSelector', () => {
  it('renders the three numeric presets, the "Tout" preset, and the counter', () => {
    setup()
    expect(screen.getByRole('button', { name: '3A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '10A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tout' })).toBeInTheDocument()
    expect(screen.getByText('5 années')).toBeInTheDocument()
  })

  it('calls onChange with the preset value when a preset is clicked', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: '3A' }))
    expect(onChange).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByRole('button', { name: '10A' }))
    expect(onChange).toHaveBeenCalledWith(10)
  })

  it('"Tout" sends max', () => {
    const { onChange } = setup({ max: 14 })
    fireEvent.click(screen.getByRole('button', { name: 'Tout' }))
    expect(onChange).toHaveBeenCalledWith(14)
  })

  it('disables presets that exceed max', () => {
    setup({ value: 2, max: 4 })
    expect(screen.getByRole('button', { name: '5A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '10A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '3A' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tout' })).not.toBeDisabled()
  })

  it('emits new value when the slider changes', () => {
    const { onChange } = setup()
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('uses singular "année" when value === 1', () => {
    setup({ value: 1, max: 14 })
    expect(screen.getByText('1 année')).toBeInTheDocument()
  })

  it('clamps display when value > max (does not crash)', () => {
    setup({ value: 99, max: 4 })
    expect(screen.getByText('4 années')).toBeInTheDocument()
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(Number(slider.value)).toBe(4)
  })
})
