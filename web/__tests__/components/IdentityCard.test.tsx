import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IdentityCard } from '@/components/settings/IdentityCard'

const mockRefresh = jest.fn()
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

const defaultProps = {
  firstName: 'Franck',
  lastName: 'Meri',
  email: 'franck@example.com',
  avatarUrl: null,
  hasCustomAvatar: false,
  accountCreatedAt: '2024-01-15T10:00:00Z',
}

beforeEach(() => jest.clearAllMocks())

describe('IdentityCard — mode lecture', () => {
  it('affiche le nom complet', () => {
    render(<IdentityCard {...defaultProps} />)
    expect(screen.getByText('Franck Meri')).toBeInTheDocument()
  })

  it('affiche "Athlète" si aucun nom', () => {
    render(<IdentityCard {...defaultProps} firstName={null} lastName={null} />)
    expect(screen.getByText('Athlète')).toBeInTheDocument()
  })

  it("affiche l'email", () => {
    render(<IdentityCard {...defaultProps} />)
    expect(screen.getByText('franck@example.com')).toBeInTheDocument()
  })

  it("affiche l'avatar si avatarUrl fourni", () => {
    render(<IdentityCard {...defaultProps} avatarUrl="https://example.com/avatar.jpg" />)
    const img = screen.getByRole('img', { name: /avatar/i })
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('n\'affiche pas le bouton "Retirer" si pas d\'avatar custom', () => {
    render(<IdentityCard {...defaultProps} hasCustomAvatar={false} />)
    expect(screen.queryByText(/retirer la photo/i)).not.toBeInTheDocument()
  })

  it('affiche le bouton "Retirer" si avatar custom présent', () => {
    render(<IdentityCard {...defaultProps} hasCustomAvatar={true} avatarUrl="https://example.com/a.jpg" />)
    expect(screen.getByText(/retirer la photo/i)).toBeInTheDocument()
  })
})

describe('IdentityCard — édition du nom', () => {
  it('passe en mode édition au clic sur le crayon', () => {
    render(<IdentityCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier le nom/i }))
    expect(screen.getByPlaceholderText('Prénom')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nom')).toBeInTheDocument()
  })

  it('annuler remet en mode lecture sans appel API', () => {
    render(<IdentityCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier le nom/i }))
    fireEvent.click(screen.getByText('Annuler'))
    expect(screen.getByText('Franck Meri')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Prénom')).not.toBeInTheDocument()
  })

  it('sauvegarde le nom via PATCH /api/profile', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock

    render(<IdentityCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier le nom/i }))

    const firstInput = screen.getByPlaceholderText('Prénom')
    fireEvent.change(firstInput, { target: { value: 'François' } })

    fireEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ first_name: 'François', last_name: 'Meri' }),
      }))
    })

    await waitFor(() => {
      expect(screen.getByText('François Meri')).toBeInTheDocument()
    })

    expect(mockRefresh).toHaveBeenCalled()
  })

  it('affiche une erreur si la sauvegarde échoue', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock

    render(<IdentityCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier le nom/i }))
    fireEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() => {
      expect(screen.getByText(/erreur/i)).toBeInTheDocument()
    })
  })
})

describe('IdentityCard — retirer avatar', () => {
  it("appelle DELETE /api/profile/avatar et retire l'avatar", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock

    render(<IdentityCard {...defaultProps} hasCustomAvatar={true} avatarUrl="https://example.com/a.jpg" />)
    fireEvent.click(screen.getByText(/retirer la photo/i))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/profile/avatar', { method: 'DELETE' })
    })

    await waitFor(() => {
      expect(screen.queryByText(/retirer la photo/i)).not.toBeInTheDocument()
    })

    expect(mockRefresh).toHaveBeenCalled()
  })
})
