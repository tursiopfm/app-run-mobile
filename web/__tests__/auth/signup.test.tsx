import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignupPage from '@/app/signup/page'

const mockSignUp = jest.fn()
jest.mock('@/lib/database/supabase-client', () => ({
  createClient: () => ({
    auth: { signUp: mockSignUp },
  }),
}))

const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

describe('SignupPage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders email and password fields with submit button', () => {
    render(<SignupPage />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /créer mon compte/i })).toBeInTheDocument()
  })

  it('shows error message on signup failure', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    })
    render(<SignupPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('User already registered')
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects to /dashboard when session is returned immediately (email confirmation off)', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: '1' }, session: { access_token: 'tok' } },
      error: null,
    })
    render(<SignupPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows check-email message when email confirmation is required', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: '1' }, session: null },
      error: null,
    })
    render(<SignupPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'confirm@example.com' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await waitFor(() => {
      expect(screen.getByText(/vérifiez votre email/i)).toBeInTheDocument()
      expect(screen.getByText('confirm@example.com')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
