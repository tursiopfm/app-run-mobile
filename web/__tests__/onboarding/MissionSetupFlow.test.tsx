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

  // Helper : avance jusqu'à l'étape Zones FC (5) en sélectionnant le minimum.
  function gotoHrStep() {
    render(<MissionSetupFlow />)
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))           // 1→2
    fireEvent.click(screen.getByRole('button', { name: /^trail/i }))              // discipline
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))           // 2→3
    fireEvent.click(screen.getByRole('button', { name: /préparer un trail/i }))   // mission
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))           // 3→4
    fireEvent.click(screen.getByRole('button', { name: /mode mission/i }))        // mode
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))           // 4→5 (Zones FC)
  }

  it('le flow compte 6 étapes', () => {
    render(<MissionSetupFlow />)
    expect(screen.getByText(/étape 1 sur 6/i)).toBeInTheDocument()
  })

  it('« Déduire automatiquement » persiste hr_zone_method=deduced', async () => {
    gotoHrStep()
    fireEvent.click(screen.getByRole('button', { name: /déduire automatiquement/i }))
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const bodies = calls.map(c => JSON.parse(c[1].body))
      expect(bodies.some(b => b.hr_zone_method === 'deduced')).toBe(true)
    })
  })

  it('le fallback FC max persiste pct_max + max_hr', async () => {
    gotoHrStep()
    fireEvent.click(screen.getByRole('button', { name: /je connais ma fc max/i }))
    fireEvent.change(screen.getByLabelText(/fc max/i), { target: { value: '190' } })
    fireEvent.click(screen.getByRole('button', { name: /valider mes zones/i }))
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const bodies = calls.map(c => JSON.parse(c[1].body))
      expect(bodies.some(b => b.hr_zone_method === 'pct_max' && b.max_hr === 190)).toBe(true)
    })
  })

  it('le fallback année de naissance persiste auto + birth_year', async () => {
    gotoHrStep()
    fireEvent.click(screen.getByRole('button', { name: /je connais ma fc max/i }))
    fireEvent.click(screen.getByRole('button', { name: /je ne la connais pas/i }))
    fireEvent.change(screen.getByLabelText(/année de naissance/i), { target: { value: '1988' } })
    fireEvent.click(screen.getByRole('button', { name: /valider mes zones/i }))
    await waitFor(() => {
      const bodies = (global.fetch as jest.Mock).mock.calls.map(c => JSON.parse(c[1].body))
      expect(bodies.some(b => b.hr_zone_method === 'auto' && b.birth_year === 1988)).toBe(true)
    })
  })

  it('l\'étape Zones FC est skippable (Continuer actif sans choix FC)', () => {
    gotoHrStep()
    expect(screen.getByRole('button', { name: /continuer/i })).not.toBeDisabled()
  })
})
