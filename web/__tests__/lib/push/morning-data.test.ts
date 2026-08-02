import { getMorningPushData } from '@/lib/push/morning-data'
import { createServiceClient } from '@/lib/database/supabase-server'
import { computeAllSportPayload } from '@/lib/data/charge'

jest.mock('@/lib/database/supabase-server', () => ({ createServiceClient: jest.fn() }))
jest.mock('@/lib/data/charge', () => ({
  CHARGE_ACTIVITY_COLUMNS: 'cols',
  CHARGE_PROFILE_COLUMNS:  'prof',
  computeAllSportPayload:  jest.fn(() => ({ insights: { status: 'overloaded' } })),
}))

const mockCreate  = createServiceClient  as jest.Mock
const mockCompute = computeAllSportPayload as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

type Fixtures = {
  activities?:      Record<string, unknown>[]
  activitiesError?: { message: string } | null
  profile?:         Record<string, number | null> | null
  profileError?:    { message: string } | null
  session?:         Record<string, unknown> | null
  sessionError?:    { message: string } | null
}

type Call = { method: string; args: unknown[] }
type Calls = Record<string, Call[]>

// Chaîne de requête Supabase minimale : chaque méthode renvoie `this` et
// enregistre son appel (pour vérifier les filtres réellement posés par le
// code). Pour `planned_sessions`, simule aussi le filtre `.eq('status', ...)`
// posé par le code — une séance dont le statut fixture ne correspond pas au
// statut demandé n'est pas renvoyée, comme le ferait Postgres.
function makeClient(fix: Fixtures, calls: Calls = {}): unknown {
  return {
    from(table: string) {
      calls[table] ??= []
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'gte', 'is', 'order', 'limit']) {
        chain[m] = (...args: unknown[]) => {
          calls[table].push({ method: m, args })
          return chain
        }
      }
      const resolve = () => {
        if (table === 'activities') {
          return { data: fix.activities ?? [], error: fix.activitiesError ?? null }
        }
        if (table === 'profiles') {
          return { data: fix.profile ?? null, error: fix.profileError ?? null }
        }
        const wantedStatus = calls[table]
          .find(c => c.method === 'eq' && c.args[0] === 'status')?.args[1]
        const matches = fix.session != null
          && (wantedStatus == null || fix.session.status === wantedStatus)
        return { data: matches ? [fix.session] : [], error: fix.sessionError ?? null }
      }
      chain.maybeSingle = () => Promise.resolve(resolve())
      chain.then = (resolveFn: (v: unknown) => unknown) => Promise.resolve(resolve()).then(resolveFn)
      return chain
    },
  }
}

const NOW = new Date('2026-08-02T05:00:00Z')

describe('getMorningPushData', () => {
  it('renvoie le status du payload et la séance du jour, filtrée par athlete_id/date', async () => {
    const calls: Calls = {}
    mockCreate.mockReturnValue(makeClient({
      session: { title: 'Sortie longue', duration_min: 90, distance_km: 18, status: 'planned' },
    }, calls))

    const data = await getMorningPushData('user-1', '2026-08-02', NOW)

    expect(data.status).toBe('overloaded')
    expect(data.session).toEqual({ title: 'Sortie longue', duration: 90, distance: 18 })

    expect(calls.activities).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] })
    expect(calls.planned_sessions).toContainEqual({ method: 'eq', args: ['athlete_id', 'user-1'] })
    expect(calls.planned_sessions).toContainEqual({ method: 'eq', args: ['date', '2026-08-02'] })
  })

  it('renvoie une séance nulle quand aucune n\'est planifiée', async () => {
    mockCreate.mockReturnValue(makeClient({ session: null }))
    const data = await getMorningPushData('user-1', '2026-08-02', NOW)
    expect(data.session).toBeNull()
    expect(data.status).toBe('overloaded')
  })

  it('renvoie une séance nulle quand la séance du jour n\'est plus "planned" (complétée/sautée/déplacée)', async () => {
    mockCreate.mockReturnValue(makeClient({
      session: { title: 'Sortie longue', duration_min: 90, distance_km: 18, status: 'skipped' },
    }))
    const data = await getMorningPushData('user-1', '2026-08-02', NOW)
    expect(data.session).toBeNull()
  })

  it('tolère un profil absent : computeAllSportPayload reçoit null (pas de zones FC renseignées)', async () => {
    mockCreate.mockReturnValue(makeClient({ profile: null, session: null }))
    await getMorningPushData('user-1', '2026-08-02', NOW)
    expect(mockCompute).toHaveBeenCalledWith(expect.anything(), null, NOW)
  })

  it('propage une erreur fatale sur la lecture des activités', async () => {
    mockCreate.mockReturnValue(makeClient({ activitiesError: { message: 'boom' } }))
    await expect(getMorningPushData('user-1', '2026-08-02', NOW)).rejects.toEqual({ message: 'boom' })
  })

  it('propage une erreur fatale sur la lecture de la séance du jour', async () => {
    mockCreate.mockReturnValue(makeClient({ sessionError: { message: 'boom' } }))
    await expect(getMorningPushData('user-1', '2026-08-02', NOW)).rejects.toEqual({ message: 'boom' })
  })

  it('tolère une erreur non fatale sur la lecture du profil', async () => {
    mockCreate.mockReturnValue(makeClient({ profileError: { message: 'boom' }, session: null }))
    await expect(getMorningPushData('user-1', '2026-08-02', NOW)).resolves.toBeDefined()
  })
})
