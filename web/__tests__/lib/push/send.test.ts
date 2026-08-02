import { isGoneStatus, sendPush } from '@/lib/push/send'
import webpush from 'web-push'

jest.mock('web-push', () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: jest.fn() },
}))

const mockSend = webpush.sendNotification as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  process.env.VAPID_SUBJECT = 'mailto:test@example.com'
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub'
  process.env.VAPID_PRIVATE_KEY = 'priv'
  // sendPush journalise désormais ses échecs non-gone (Finding 1) : on
  // supprime le bruit console par défaut, deux tests dédiés vérifient le
  // contenu du journal.
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

const target = { endpoint: 'https://push.example/abc', p256dh: 'k', auth: 'a' }
const payload = { title: 'Rapport matinal', body: 'Corps', url: '/rapport-matinal' }

describe('sendPush - configuration', () => {
  it('appelle setVapidDetails avec subject, clé publique, clé privée dans cet ordre', async () => {
    mockSend.mockResolvedValueOnce({})
    const mockSetVapidDetails = webpush.setVapidDetails as jest.Mock

    await sendPush(target, payload)

    expect(mockSetVapidDetails).toHaveBeenCalledWith(
      'mailto:test@example.com',
      'pub',
      'priv',
    )
  })
})

describe('isGoneStatus', () => {
  it('considère 404 et 410 comme abonnements morts', () => {
    expect(isGoneStatus(404)).toBe(true)
    expect(isGoneStatus(410)).toBe(true)
  })

  it('considère les autres codes comme transitoires', () => {
    expect(isGoneStatus(500)).toBe(false)
    expect(isGoneStatus(429)).toBe(false)
    expect(isGoneStatus(undefined)).toBe(false)
  })
})

describe('sendPush', () => {
  it('sérialise le payload en JSON et renvoie "sent"', async () => {
    mockSend.mockResolvedValueOnce({})
    await expect(sendPush(target, payload)).resolves.toBe('sent')
    expect(mockSend).toHaveBeenCalledWith(
      { endpoint: target.endpoint, keys: { p256dh: 'k', auth: 'a' } },
      JSON.stringify(payload),
    )
  })

  it('renvoie "gone" sur 410', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
    await expect(sendPush(target, payload)).resolves.toBe('gone')
  })

  it('renvoie "failed" sur erreur transitoire', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }))
    await expect(sendPush(target, payload)).resolves.toBe('failed')
  })

  it('renvoie "failed" sur erreur réseau sans statusCode', async () => {
    mockSend.mockRejectedValueOnce(new Error('ECONNRESET'))
    await expect(sendPush(target, payload)).resolves.toBe('failed')
  })

  it('journalise la cause d\'un échec non-gone sans exposer l\'endpoint', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }))

    await sendPush(target, payload)

    const consoleSpy = console.error as jest.Mock
    expect(consoleSpy).toHaveBeenCalled()
    const loggedText = consoleSpy.mock.calls.flat().map(a => JSON.stringify(a)).join(' ')
    expect(loggedText).toContain('500')
    expect(loggedText).toContain('boom')
    expect(loggedText).not.toContain(target.endpoint)
  })

  it('ne journalise rien sur "gone" (attendu, pas une panne)', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))

    await sendPush(target, payload)

    expect(console.error as jest.Mock).not.toHaveBeenCalled()
  })
})
