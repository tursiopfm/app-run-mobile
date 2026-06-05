// web/__tests__/onboarding/MissionSetupFlow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MissionSetupFlow } from '@/components/onboarding/mission-setup/MissionSetupFlow'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as jest.Mock
})

describe('MissionSetupFlow', () => {
  it('bloque « Continuer » tant qu\'aucune discipline n\'est choisie', () => {
    render(<MissionSetupFlow />)
    // Étape 1 → 2
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))
    expect(screen.getByRole('button', { name: /continuer/i })).toBeDisabled()
    // Choisir une discipline débloque
    fireEvent.click(screen.getByRole('button', { name: /^trail/i }))
    expect(screen.getByRole('button', { name: /continuer/i })).not.toBeDisabled()
  })

  it('persiste chaque réponse au moment de la sélection', async () => {
    render(<MissionSetupFlow />)
    fireEvent.click(screen.getByRole('button', { name: /continuer/i })) // étape 2
    fireEvent.click(screen.getByRole('button', { name: /^trail/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PATCH' }))
    })
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.onboarding_discipline).toBe('trail')
  })

  it('affiche l\'erreur Strava, démarre sur l\'étape Données, et la tuile Strava est un lien', () => {
    render(<MissionSetupFlow stravaStatus="already_linked" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/déjà connecté/i)
    expect(screen.getByRole('link', { name: /^strava/i }))
      .toHaveAttribute('href', '/api/strava/connect?from=onboarding')
  })

  it('« Entrer dans le cockpit » complète l\'onboarding et route vers le dashboard', async () => {
    render(<MissionSetupFlow stravaStatus="error" />)
    fireEvent.click(screen.getByRole('button', { name: /lancer le cockpit/i }))
    fireEvent.click(screen.getByRole('button', { name: /entrer dans le cockpit/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PATCH' }))
    })
    const calls = (global.fetch as jest.Mock).mock.calls
    const body = JSON.parse(calls[calls.length - 1][1].body)
    expect(body.onboarding_complete).toBe(true)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'))
  })

  it('en cas d\'échec de complétion, garde l\'utilisateur sur place avec une erreur', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as jest.Mock
    render(<MissionSetupFlow stravaStatus="error" />)
    fireEvent.click(screen.getByRole('button', { name: /lancer le cockpit/i }))
    fireEvent.click(screen.getByRole('button', { name: /entrer dans le cockpit/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/enregistrement a échoué/i)
    })
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /entrer dans le cockpit/i })).not.toBeDisabled()
  })
})
