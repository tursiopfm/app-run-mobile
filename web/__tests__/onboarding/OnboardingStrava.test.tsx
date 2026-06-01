import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { OnboardingStrava } from '@/components/onboarding/OnboardingStrava'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

function renderOnboarding() {
  return render(
    <I18nProvider initialLang="fr">
      <OnboardingStrava />
    </I18nProvider>,
  )
}

describe('OnboardingStrava', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as jest.Mock
  })

  it('le CTA pointe vers le endpoint connect avec from=onboarding', () => {
    renderOnboarding()
    const cta = screen.getByRole('link', { name: /connecter mon compte strava/i })
    expect(cta).toHaveAttribute('href', '/api/strava/connect?from=onboarding')
  })

  it('« Plus tard » persiste onboarding_skipped puis route vers le dashboard', async () => {
    renderOnboarding()
    fireEvent.click(screen.getByRole('button', { name: /plus tard/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ onboarding_skipped: true }),
        }),
      )
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})
