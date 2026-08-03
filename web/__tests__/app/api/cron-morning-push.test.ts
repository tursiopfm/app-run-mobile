/** @jest-environment node */
import { GET } from '@/app/api/cron/morning-push/route'
import { fetchPendingSubscriptions, markNotified, deleteSubscriptionById } from '@/lib/push/subscriptions'
import { getMorningPushData } from '@/lib/push/morning-data'
import { sendPush } from '@/lib/push/send'

jest.mock('@/lib/push/subscriptions', () => ({
  fetchPendingSubscriptions: jest.fn(),
  markNotified:              jest.fn(),
  deleteSubscriptionById:    jest.fn(),
}))
jest.mock('@/lib/push/morning-data', () => ({ getMorningPushData: jest.fn() }))
jest.mock('@/lib/push/send', () => ({ sendPush: jest.fn() }))

const mockFetch  = fetchPendingSubscriptions as jest.Mock
const mockData   = getMorningPushData as jest.Mock
const mockSend   = sendPush as jest.Mock
const mockMark   = markNotified as jest.Mock
const mockDelete = deleteSubscriptionById as jest.Mock

function req(secret = 'S3CR3T', query = ''): Request {
  return new Request(`http://localhost/api/cron/morning-push${query}`, {
    headers: { authorization: `Bearer ${secret}` },
  })
}

// Fige l'horloge : 05:00 UTC le 2 août = 07:00 à Paris (été) → dans la fenêtre.
function freeze(iso: string) {
  jest.useFakeTimers().setSystemTime(new Date(iso))
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.CRON_SECRET = 'S3CR3T'
  mockData.mockResolvedValue({ status: 'balanced', session: null })
})
afterEach(() => jest.useRealTimers())

it('refuse un Bearer invalide', async () => {
  freeze('2026-08-02T05:00:00Z')
  const res = await GET(req('WRONG'))
  expect(res.status).toBe(401)
})

it('refuse même un Bearer correct si CRON_SECRET est absent (fail-closed)', async () => {
  freeze('2026-08-02T05:00:00Z')
  delete process.env.CRON_SECRET
  const res = await GET(req())
  expect(res.status).toBe(401)
})

it('ne fait rien hors de la fenêtre matinale', async () => {
  freeze('2026-08-02T04:00:00Z')   // 06:00 à Paris
  const res = await GET(req())
  expect(await res.json()).toEqual({ skipped: true, reason: 'outside-window' })
  expect(mockFetch).not.toHaveBeenCalled()
})

it('force=1 court-circuite la garde horaire', async () => {
  freeze('2026-08-02T20:00:00Z')   // 22:00 à Paris, très loin de la fenêtre
  mockFetch.mockResolvedValue([
    { id: 's1', user_id: 'u1', endpoint: 'e1', p256dh: 'k', auth: 'a' },
  ])
  mockSend.mockResolvedValue('sent')

  const res = await GET(req('S3CR3T', '?force=1'))
  expect(await res.json()).toEqual({ sent: 1, removed: 0, failed: 0, batch: 1 })
})

it('force=1 ne dispense pas du Bearer', async () => {
  freeze('2026-08-02T20:00:00Z')
  const res = await GET(req('WRONG', '?force=1'))
  expect(res.status).toBe(401)
  expect(mockFetch).not.toHaveBeenCalled()
})

it('envoie et marque les abonnements du lot', async () => {
  freeze('2026-08-02T05:00:00Z')
  mockFetch.mockResolvedValue([
    { id: 's1', user_id: 'u1', endpoint: 'e1', p256dh: 'k', auth: 'a' },
  ])
  mockSend.mockResolvedValue('sent')

  const res = await GET(req())
  expect(await res.json()).toEqual({ sent: 1, removed: 0, failed: 0, batch: 1 })
  expect(mockMark).toHaveBeenCalledWith('s1', '2026-08-02')
})

it('supprime un abonnement mort sans le marquer', async () => {
  freeze('2026-08-02T05:00:00Z')
  mockFetch.mockResolvedValue([
    { id: 's1', user_id: 'u1', endpoint: 'e1', p256dh: 'k', auth: 'a' },
  ])
  mockSend.mockResolvedValue('gone')

  const res = await GET(req())
  expect(await res.json()).toEqual({ sent: 0, removed: 1, failed: 0, batch: 1 })
  expect(mockDelete).toHaveBeenCalledWith('s1')
  expect(mockMark).not.toHaveBeenCalled()
})

it('ne calcule la charge qu\'une fois pour un utilisateur multi-appareils', async () => {
  freeze('2026-08-02T05:00:00Z')
  mockFetch.mockResolvedValue([
    { id: 's1', user_id: 'u1', endpoint: 'e1', p256dh: 'k', auth: 'a' },
    { id: 's2', user_id: 'u1', endpoint: 'e2', p256dh: 'k', auth: 'a' },
  ])
  mockSend.mockResolvedValue('sent')

  const res = await GET(req())
  expect(await res.json()).toEqual({ sent: 2, removed: 0, failed: 0, batch: 2 })
  expect(mockData).toHaveBeenCalledTimes(1)
})

it('compte un échec transitoire sans marquer ni supprimer', async () => {
  freeze('2026-08-02T05:00:00Z')
  mockFetch.mockResolvedValue([
    { id: 's1', user_id: 'u1', endpoint: 'e1', p256dh: 'k', auth: 'a' },
  ])
  mockSend.mockResolvedValue('failed')

  const res = await GET(req())
  expect(await res.json()).toEqual({ sent: 0, removed: 0, failed: 1, batch: 1 })
  expect(mockMark).not.toHaveBeenCalled()
  expect(mockDelete).not.toHaveBeenCalled()
})

it('continue le lot quand getMorningPushData lève pour un abonnement', async () => {
  freeze('2026-08-02T05:00:00Z')
  mockFetch.mockResolvedValue([
    { id: 's1', user_id: 'u1', endpoint: 'e1', p256dh: 'k', auth: 'a' },
    { id: 's2', user_id: 'u2', endpoint: 'e2', p256dh: 'k', auth: 'a' },
  ])
  // u1 échoue à la lecture des données (activités/séances), u2 réussit — sur
  // la valeur par défaut posée en beforeEach.
  mockData.mockRejectedValueOnce(new Error('lecture activités KO'))
  mockSend.mockResolvedValue('sent')
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  const res = await GET(req())
  expect(await res.json()).toEqual({ sent: 1, removed: 0, failed: 1, batch: 2 })
  // s1 n'a jamais atteint sendPush/markNotified : l'exception a été absorbée
  // avant, et le lot a continué jusqu'à s2 plutôt que de s'interrompre.
  expect(mockSend).toHaveBeenCalledTimes(1)
  expect(mockMark).toHaveBeenCalledWith('s2', '2026-08-02')
  expect(mockMark).not.toHaveBeenCalledWith('s1', '2026-08-02')

  consoleSpy.mockRestore()
})
