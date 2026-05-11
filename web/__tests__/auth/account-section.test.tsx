import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AccountSection } from '@/components/settings/AccountSection'

const mockGetUser = jest.fn()
const mockSignOut = jest.fn()
jest.mock('@/lib/database/supabase-client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser, signOut: mockSignOut },
  }),
}))

const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

describe('AccountSection', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { container } = render(<AccountSection />)
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('displays user email when authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'runner@example.com' } } })
    render(<AccountSection />)
    await waitFor(() => {
      expect(screen.getByText('runner@example.com')).toBeInTheDocument()
    })
  })

  it('signs out and redirects to / on logout click', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'runner@example.com' } } })
    mockSignOut.mockResolvedValue({})
    render(<AccountSection />)
    await waitFor(() => screen.getByText('runner@example.com'))
    fireEvent.click(screen.getByRole('button', { name: /déconnexion/i }))
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
