import { maybePushPlanTitleToStrava } from '@/lib/plan/push-title'
import { updateStravaActivityName } from '@/lib/providers/strava/api'

jest.mock('@/lib/providers/strava/api', () => ({
  updateStravaActivityName: jest.fn().mockResolvedValue(undefined),
}))

const mockUpdate = updateStravaActivityName as jest.Mock

// ── Sample rows ────────────────────────────────────────────────────────────
const NEW_ACT_ID = 'act-new-uuid'
const SECOND_ACT_ID = 'act-second-uuid'
const SESSION_ID = 'sess-uuid'
const USER_ID = 'user-uuid'
const TOKEN = 'strava-token'
const STRAVA_ID = '987654321'

// Activité « run » 10 km / 100 m D+, le mercredi de la semaine en cours
const newActRow = {
  id: NEW_ACT_ID,
  provider_activity_id: STRAVA_ID,
  start_time: '2026-05-20T08:00:00Z', // mercredi
  sport_type: 'Run',
  manual_sport_type: null,
  distance_m: 10000,
  manual_distance_m: null,
  elevation_gain_m: 100,
  manual_elevation_gain_m: null,
}

// Séance planifiée le même jour, même catégorie, distance équivalente
const plannedSessionRow = {
  id: SESSION_ID,
  plan_id: null,
  date: '2026-05-20',
  type: 'footing',
  title: 'Footing récup 10 km',
  duration_min: 60,
  distance_km: 10,
  elevation_m: 100,
  intensity: 2,
  estimated_charge: 40,
  zones: null,
  notes: null,
  status: 'planned',
  linked_activity_id: null,
  template_id: null,
}

// Catalogue minimal — footing existe en builtin donc le catalog peut être vide,
// mais on inclut quand même les types système pour rester réaliste.
const catalogRows = [
  { id: 'cat-1', slug: 'footing', label: 'Footing', default_intensity: 2, category: 'run', is_system: true },
]

// ── Mock builder ───────────────────────────────────────────────────────────
type Overrides = {
  profile?: { data: any; error: any }
  newAct?: { data: any; error: any }
  weekActs?: { data: any; error: any }
  sessions?: { data: any; error: any }
  catalog?: { data: any; error: any }
}

function buildSupabase(over: Overrides = {}) {
  const profileSingle = jest.fn().mockResolvedValue(
    over.profile ?? { data: { plan_auto_push_title: true }, error: null }
  )
  const newActSingle = jest.fn().mockResolvedValue(
    over.newAct ?? { data: newActRow, error: null }
  )
  const weekActsResult = over.weekActs ?? { data: [newActRow], error: null }
  const sessionsResult = over.sessions ?? { data: [plannedSessionRow], error: null }
  const catalogResult = over.catalog ?? { data: catalogRows, error: null }

  const profilesChain = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({ single: profileSingle }),
    }),
  }

  // activities : 2 usages
  //   .select(...).eq('id', X).single()   → nouvelle activité
  //   .select(...).eq('user_id', X).is(...).gte(...).lt(...)  → semaine
  const activitiesChain = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockImplementation((col: string) => {
        if (col === 'id') {
          return { single: newActSingle }
        }
        // user_id
        return {
          is: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lt: jest.fn().mockResolvedValue(weekActsResult),
            }),
          }),
        }
      }),
    }),
  }

  const sessionsChain = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        gte: jest.fn().mockReturnValue({
          lte: jest.fn().mockResolvedValue(sessionsResult),
        }),
      }),
    }),
  }

  const catalogChain = {
    select: jest.fn().mockResolvedValue(catalogResult),
  }

  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain
      if (table === 'activities') return activitiesChain
      if (table === 'planned_sessions') return sessionsChain
      if (table === 'activity_types') return catalogChain
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

beforeEach(() => jest.clearAllMocks())

describe('maybePushPlanTitleToStrava', () => {
  it('push le titre quand match 1↔1 et titre non vide', async () => {
    const supabase = buildSupabase()
    const res = await maybePushPlanTitleToStrava({
      supabase,
      userId: USER_ID,
      accessToken: TOKEN,
      newActivityId: NEW_ACT_ID,
    })
    expect(res).toEqual({ pushed: true })
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(TOKEN, Number(STRAVA_ID), 'Footing récup 10 km')
  })

  it('ne push rien si plan_auto_push_title = false', async () => {
    const supabase = buildSupabase({
      profile: { data: { plan_auto_push_title: false }, error: null },
    })
    const res = await maybePushPlanTitleToStrava({
      supabase,
      userId: USER_ID,
      accessToken: TOKEN,
      newActivityId: NEW_ACT_ID,
    })
    expect(res).toEqual({ pushed: false, reason: 'pref_off' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('ne push rien quand match cumul (2 activités sur 1 séance velotaf)', async () => {
    // Séance velotaf 30km / 200m, 2 activités du jour qui font le cumul
    const cumulSession = {
      ...plannedSessionRow,
      type: 'velotaf',
      title: 'Velotaf A/R',
      distance_km: 30,
      elevation_m: 200,
    }
    const a1 = {
      ...newActRow,
      sport_type: 'Ride',
      distance_m: 15000,
      elevation_gain_m: 100,
    }
    const a2 = {
      id: SECOND_ACT_ID,
      provider_activity_id: '111111',
      start_time: '2026-05-20T18:00:00Z',
      sport_type: 'Ride',
      manual_sport_type: null,
      distance_m: 15000,
      manual_distance_m: null,
      elevation_gain_m: 100,
      manual_elevation_gain_m: null,
    }
    const supabase = buildSupabase({
      newAct: { data: a1, error: null },
      weekActs: { data: [a1, a2], error: null },
      sessions: { data: [cumulSession], error: null },
    })
    const res = await maybePushPlanTitleToStrava({
      supabase,
      userId: USER_ID,
      accessToken: TOKEN,
      newActivityId: NEW_ACT_ID,
    })
    expect(res).toEqual({ pushed: false, reason: 'no_match_1to1' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('ne push rien si match 1↔1 mais titre vide', async () => {
    const supabase = buildSupabase({
      sessions: { data: [{ ...plannedSessionRow, title: '   ' }], error: null },
    })
    const res = await maybePushPlanTitleToStrava({
      supabase,
      userId: USER_ID,
      accessToken: TOKEN,
      newActivityId: NEW_ACT_ID,
    })
    expect(res).toEqual({ pushed: false, reason: 'empty_title' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('ne push rien si aucun match (sportType différent)', async () => {
    const swimAct = { ...newActRow, sport_type: 'Swim' }
    const supabase = buildSupabase({
      newAct: { data: swimAct, error: null },
      weekActs: { data: [swimAct], error: null },
      // séance reste de type footing (run) → catégorie différente
    })
    const res = await maybePushPlanTitleToStrava({
      supabase,
      userId: USER_ID,
      accessToken: TOKEN,
      newActivityId: NEW_ACT_ID,
    })
    expect(res).toEqual({ pushed: false, reason: 'no_match_1to1' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('retourne { pushed: false, reason: error: ... } sur erreur DB et ne throw pas', async () => {
    const supabase = buildSupabase({
      weekActs: { data: null, error: { message: 'DB down' } },
    })
    const res = await maybePushPlanTitleToStrava({
      supabase,
      userId: USER_ID,
      accessToken: TOKEN,
      newActivityId: NEW_ACT_ID,
    })
    expect(res.pushed).toBe(false)
    expect(res.reason).toMatch(/^error:/)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
