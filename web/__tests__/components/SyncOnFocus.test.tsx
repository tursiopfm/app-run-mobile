import { render, waitFor } from '@testing-library/react'
import { SyncOnFocus } from '@/components/navigation/SyncOnFocus'

const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

describe('SyncOnFocus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockResolvedValue({ status: 200 }) as unknown as typeof fetch
  })

  // Un lancement à froid de la PWA n'émet PAS de visibilitychange (le document
  // initial est déjà visible) : sans revalidation au montage, un document servi
  // depuis le cache du service worker garde ses données figées à l'écran.
  it('revalide les données serveur dès le montage, sans visibilitychange', async () => {
    render(<SyncOnFocus />)
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })

  it('déclenche la sync Strava dès le montage', async () => {
    render(<SyncOnFocus />)
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/strava/sync', { method: 'POST' }),
    )
  })

  it('revalide aussi au retour au premier plan', async () => {
    render(<SyncOnFocus />)
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    mockRefresh.mockClear()
    ;(global.fetch as jest.Mock).mockClear()

    // Le throttle d'une minute couvre la sync ; le refresh reste immédiat.
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })
})
