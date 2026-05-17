import { render, screen, fireEvent } from '@testing-library/react'
import { RepeatZoneCard } from '@/components/plan/RepeatZoneCard'
import type { RepeatZone } from '@/types/plan'

const sample: RepeatZone = {
  id: 'z1',
  kind: 'repeat',
  repeats: 4,
  skipLastRecovery: false,
  steps: [
    { id: 's1', stepKind: 'effort', mode: 'distance', distanceM: 400, intensityMode: 'level', intensity: 5 },
    { id: 's2', stepKind: 'recovery', mode: 'duration', durationMin: 1, intensityMode: 'level', intensity: 1 },
  ],
}

describe('<RepeatZoneCard>', () => {
  it('renders the repeat header with N', () => {
    render(<RepeatZoneCard zone={sample} sessionType="fractionne" onChange={() => {}} onDelete={() => {}} />)
    expect(screen.getByLabelText(/répéter/i)).toHaveValue(4)
  })

  it('renders one row per step', () => {
    render(<RepeatZoneCard zone={sample} sessionType="fractionne" onChange={() => {}} onDelete={() => {}} />)
    expect(screen.getAllByText(/modifier étape/i)).toHaveLength(2)
  })

  it('calls onChange when repeats input changes', () => {
    const onChange = jest.fn()
    render(<RepeatZoneCard zone={sample} sessionType="fractionne" onChange={onChange} onDelete={() => {}} />)
    fireEvent.change(screen.getByLabelText(/répéter/i), { target: { value: '6' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ repeats: 6 }))
  })

  it('toggles skipLastRecovery checkbox', () => {
    const onChange = jest.fn()
    render(<RepeatZoneCard zone={sample} sessionType="fractionne" onChange={onChange} onDelete={() => {}} />)
    fireEvent.click(screen.getByLabelText(/ignorer la dernière récupération/i))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ skipLastRecovery: true }))
  })
})
