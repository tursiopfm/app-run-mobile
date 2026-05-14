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
  birthDate: null,
  sex: null,
  avatarUrl: null,
  hasCustomAvatar: false,
  accountCreatedAt: '2024-01-15T10:00:00Z',
}

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  jest.clearAllMocks()
})

describe('IdentityCard — affichage', () => {
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

  it('affiche les inputs pré-remplis', () => {
    render(<IdentityCard {...defaultProps} birthDate="1990-05-12" sex="male" />)
    expect(screen.getByPlaceholderText('Prénom')).toHaveValue('Franck')
    expect(screen.getByPlaceholderText('Nom')).toHaveValue('Meri')
    expect(screen.getByDisplayValue('1990-05-12')).toBeInTheDocument()
    const homme = screen.getByRole('button', { name: 'Homme' })
    expect(homme.className).toContain('border-trail-primary')
  })
})

describe('IdentityCard — sauvegarde', () => {
  it('bouton désactivé tant que rien n\'est modifié', () => {
    render(<IdentityCard {...defaultProps} />)
    expect(screen.getByText(/aucune modification/i)).toBeInTheDocument()
  })

  it('sauvegarde tous les champs via PATCH /api/profile', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock

    render(<IdentityCard {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('Prénom'), { target: { value: 'François' } })
    fireEvent.click(screen.getByRole('button', { name: 'Homme' }))

    fireEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          first_name: 'François',
          last_name:  'Meri',
          birth_date: null,
          sex:        'male',
        }),
      }))
    })

    expect(mockRefresh).toHaveBeenCalled()
  })

  it('sélectionner deux fois le même sexe le désélectionne', () => {
    render(<IdentityCard {...defaultProps} sex="female" />)
    const femme = screen.getByRole('button', { name: 'Femme' })
    fireEvent.click(femme)
    expect(screen.getByText(/non précisé/i)).toBeInTheDocument()
  })

  it('affiche une erreur si la sauvegarde échoue', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock

    render(<IdentityCard {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText('Prénom'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }))

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

  it('affiche une erreur si le retrait échoue', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock

    render(<IdentityCard {...defaultProps} hasCustomAvatar={true} avatarUrl="https://example.com/a.jpg" />)
    fireEvent.click(screen.getByText(/retirer la photo/i))

    await waitFor(() => {
      expect(screen.getByText(/erreur/i)).toBeInTheDocument()
    })
  })
})

describe('IdentityCard — upload avatar', () => {
  it('upload réussi met à jour l\'avatar et affiche le bouton Retirer', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://example.com/new-avatar.jpg' }),
    }) as jest.Mock

    render(<IdentityCard {...defaultProps} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/profile/avatar',
        expect.objectContaining({ method: 'POST' })
      )
    })

    await waitFor(() => {
      const img = screen.getByRole('img', { name: /avatar/i })
      expect(img).toHaveAttribute('src', 'https://example.com/new-avatar.jpg')
    })

    expect(screen.getByText(/retirer la photo/i)).toBeInTheDocument()
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('upload échoué affiche une erreur', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock

    render(<IdentityCard {...defaultProps} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/erreur/i)).toBeInTheDocument()
    })
  })
})
