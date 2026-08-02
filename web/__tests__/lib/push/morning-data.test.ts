import { getMorningPushData } from '@/lib/push/morning-data'
import { createServiceClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({ createServiceClient: jest.fn() }))
jest.mock('@/lib/data/charge', () => ({
  CHARGE_ACTIVITY_COLUMNS: 'cols',
  CHARGE_PROFILE_COLUMNS:  'prof',
  computeAllSportPayload:  jest.fn(() => ({ insights: { status: 'overloaded' } })),
}))

const mockCreate = createServiceClient as jest.Mock

type Fixtures = {
  activities?: Record<string, unknown>[]
  profile?:    Record<string, number | null> | null
  session?:    Record<string, unknown> | null
}

// Chaîne de requête Supabase minimale : chaque méthode renvoie `this`, la
// résolution finale est décidée par la table interrogée.
function makeClient(fix: Fixtures): unknown {
  return {
    from(table: string) {
      const result =
        table === 'activities'       ? { data: fix.activities ?? [] } :
        table === 'profiles'         ? { data: fix.profile ?? null } :
        /* planned_sessions */         { data: fix.session ? [fix.session] : [] }
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'gte', 'is', 'order', 'limit']) {
        chain[m] = () => chain
      }
      chain.maybeSingle = () => Promise.resolve(result)
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
      return chain
    },
  }
}

const NOW = new Date('2026-08-02T05:00:00Z')

describe('getMorningPushData', () => {
  it('renvoie le status du payload et la séance du jour', async () => {
    mockCreate.mockReturnValue(makeClient({
      session: { title: 'Sortie longue', duration_min: 90, distance_km: 18 },
    }))
    const data = await getMorningPushData('user-1', '2026-08-02', NOW)
    expect(data.status).toBe('overloaded')
    expect(data.session).toEqual({ title: 'Sortie longue', duration: 90, distance: 18 })
  })

  it('renvoie une séance nulle quand aucune n\'est planifiée', async () => {
    mockCreate.mockReturnValue(makeClient({ session: null }))
    const data = await getMorningPushData('user-1', '2026-08-02', NOW)
    expect(data.session).toBeNull()
    expect(data.status).toBe('overloaded')
  })

  it('tolère un profil absent (pas de zones FC renseignées)', async () => {
    mockCreate.mockReturnValue(makeClient({ profile: null, session: null }))
    await expect(getMorningPushData('user-1', '2026-08-02', NOW)).resolves.toBeDefined()
  })
})
