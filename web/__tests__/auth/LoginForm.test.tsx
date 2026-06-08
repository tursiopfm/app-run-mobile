import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { LoginForm } from '@/components/auth/LoginForm'

const auth = {
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  verifyOtp: jest.fn(),
  updateUser: jest.fn(),
  resend: jest.fn(),
}
jest.mock('@/lib/database/supabase-client', () => ({
  createClient: () => ({ auth }),
}))

const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

function renderForm() {
  return render(
    <I18nProvider initialLang="fr">
      <LoginForm />
    </I18nProvider>
  )
}

function type(placeholderOrLabel: RegExp, val: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholderOrLabel), { target: { value: val } })
}

beforeEach(() => jest.clearAllMocks())

describe('LoginForm — inscription par code', () => {
  it('après signUp sans session, passe à la saisie du code', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }))
    type(/^email$/i, 'new@runner.io')
    fireEvent.change(screen.getAllByPlaceholderText(/mot de passe/i)[0], { target: { value: 'secret6' } })
    fireEvent.change(screen.getByPlaceholderText(/confirmer le mot de passe/i), { target: { value: 'secret6' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await waitFor(() => expect(screen.getByText(/entre le code reçu/i)).toBeInTheDocument())
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'new@runner.io', password: 'secret6' })
  })

  it('vérifie le code (type signup) puis redirige vers /dashboard', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null })
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }))
    type(/^email$/i, 'new@runner.io')
    fireEvent.change(screen.getAllByPlaceholderText(/mot de passe/i)[0], { target: { value: 'secret6' } })
    fireEvent.change(screen.getByPlaceholderText(/confirmer le mot de passe/i), { target: { value: 'secret6' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await screen.findByText(/entre le code reçu/i)
    const boxes = screen.getAllByRole('textbox')
    ;['1', '2', '3', '4', '5', '6'].forEach((d, i) =>
      fireEvent.change(boxes[i], { target: { value: d } })
    )
    fireEvent.click(screen.getByRole('button', { name: /^vérifier$/i }))
    await waitFor(() => {
      expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'new@runner.io', token: '123456', type: 'signup' })
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('affiche une erreur si le code est invalide', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null })
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { message: 'Token has expired or is invalid' } })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }))
    type(/^email$/i, 'new@runner.io')
    fireEvent.change(screen.getAllByPlaceholderText(/mot de passe/i)[0], { target: { value: 'secret6' } })
    fireEvent.change(screen.getByPlaceholderText(/confirmer le mot de passe/i), { target: { value: 'secret6' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await screen.findByText(/entre le code reçu/i)
    const boxes = screen.getAllByRole('textbox')
    ;['9', '9', '9', '9', '9', '9'].forEach((d, i) =>
      fireEvent.change(boxes[i], { target: { value: d } })
    )
    fireEvent.click(screen.getByRole('button', { name: /^vérifier$/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('réinitialise les identifiants en revenant à la connexion', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }))
    type(/^email$/i, 'new@runner.io')
    fireEvent.change(screen.getAllByPlaceholderText(/mot de passe/i)[0], { target: { value: 'secret6' } })
    fireEvent.change(screen.getByPlaceholderText(/confirmer le mot de passe/i), { target: { value: 'secret6' } })
    fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
    await screen.findByText(/entre le code reçu/i)
    fireEvent.click(screen.getByRole('button', { name: /retour à la connexion/i }))
    const pw = screen.getAllByPlaceholderText(/mot de passe/i)[0] as HTMLInputElement
    expect(pw.value).toBe('')
  })
})

describe('LoginForm — reset par code', () => {
  it('demande le code puis change le mot de passe', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
    auth.updateUser.mockResolvedValue({ data: {}, error: null })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /mot de passe oublié/i }))
    type(/^email$/i, 'lost@runner.io')
    fireEvent.click(screen.getByRole('button', { name: /envoyer le lien|envoyer le code/i }))
    await screen.findByText(/réinitialise ton mot de passe/i)
    const boxes = screen.getAllByRole('textbox')
    ;['1', '2', '3', '4', '5', '6'].forEach((d, i) =>
      fireEvent.change(boxes[i], { target: { value: d } })
    )
    fireEvent.change(screen.getByPlaceholderText(/nouveau mot de passe/i), { target: { value: 'brandnew6' } })
    fireEvent.change(screen.getByPlaceholderText(/confirmer le mot de passe/i), { target: { value: 'brandnew6' } })
    fireEvent.click(screen.getByRole('button', { name: /^vérifier$/i }))
    await waitFor(() => {
      expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'lost@runner.io', token: '123456', type: 'recovery' })
      expect(auth.updateUser).toHaveBeenCalledWith({ password: 'brandnew6' })
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})

describe('LoginForm — connexion', () => {
  it('se connecte et redirige vers /dashboard', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null })
    renderForm()
    type(/^email$/i, 'me@runner.io')
    fireEvent.change(screen.getAllByPlaceholderText(/mot de passe/i)[0], { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await waitFor(() => {
      expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'me@runner.io', password: 'pass123' })
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('affiche une erreur si identifiants invalides', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    renderForm()
    type(/^email$/i, 'me@runner.io')
    fireEvent.change(screen.getAllByPlaceholderText(/mot de passe/i)[0], { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid login credentials'))
    expect(mockPush).not.toHaveBeenCalled()
  })
})
