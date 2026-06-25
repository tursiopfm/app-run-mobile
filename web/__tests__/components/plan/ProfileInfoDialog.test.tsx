import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileInfoDialog } from '@/components/plan/ProfileInfoDialog'
import { DEFAULT_PROFILE_INFO } from '@/lib/plan/print-profile-info'

describe('ProfileInfoDialog', () => {
  it('ne rend rien quand fermé', () => {
    const { container } = render(
      <ProfileInfoDialog open={false} config={DEFAULT_PROFILE_INFO} onChange={() => {}} onClose={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('bascule une couche via onChange', () => {
    const onChange = jest.fn()
    render(<ProfileInfoDialog open config={DEFAULT_PROFILE_INFO} onChange={onChange} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('Objectif horaire'))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_PROFILE_INFO, objectif: false })
  })
})
