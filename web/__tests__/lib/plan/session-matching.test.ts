import {
  matchSessionsToActivities,
  activityCategory,
  type MatchableActivity,
} from '@/lib/plan/session-matching'
import type { PlannedSession } from '@/types/plan'
import type { ActivityType } from '@/types/activity-types'

const catalog: ActivityType[] = []

function makeSession(over: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'sess-1',
    planId: '',
    date: '2026-05-20',
    type: 'sortie_longue',
    title: 'SL 25km',
    duration: 180,
    distance: 25,
    elevation: 800,
    intensity: 2,
    estimatedCharge: 100,
    status: 'planned',
    ...over,
  }
}

function makeActivity(over: Partial<MatchableActivity> = {}): MatchableActivity {
  return {
    id: 'act-1',
    date: '2026-05-20',
    sportType: 'TrailRun',
    distanceKm: 25,
    elevationM: 800,
    ...over,
  }
}

describe('activityCategory', () => {
  it('mappe Run/TrailRun → run', () => {
    expect(activityCategory('Run')).toBe('run')
    expect(activityCategory('TrailRun')).toBe('run')
  })
  it('mappe Ride/VirtualRide/EBikeRide → bike', () => {
    expect(activityCategory('Ride')).toBe('bike')
    expect(activityCategory('VirtualRide')).toBe('bike')
    expect(activityCategory('EBikeRide')).toBe('bike')
  })
  it('mappe Swim → swim', () => {
    expect(activityCategory('Swim')).toBe('swim')
  })
  it('sport inconnu → other', () => {
    expect(activityCategory('WeightTraining')).toBe('other')
    expect(activityCategory('Hike')).toBe('other')
  })
})

describe('matchSessionsToActivities', () => {
  it('match nominal : même jour, même catégorie, distance/D+ cohérents', () => {
    const sessions = [makeSession()]
    const activities = [makeActivity()]
    const map = matchSessionsToActivities(sessions, activities, catalog)
    expect(map.get('sess-1')).toEqual(['act-1'])
  })

  it('pas de match si jour différent', () => {
    const sessions = [makeSession({ date: '2026-05-20' })]
    const activities = [makeActivity({ date: '2026-05-21' })]
    const map = matchSessionsToActivities(sessions, activities, catalog)
    expect(map.size).toBe(0)
  })

  it('pas de match si catégorie différente (séance running vs activité vélo)', () => {
    const sessions = [makeSession({ type: 'footing' })]
    const activities = [makeActivity({ sportType: 'Ride' })]
    const map = matchSessionsToActivities(sessions, activities, catalog)
    expect(map.size).toBe(0)
  })

  it('tolérance distance ±25 % respectée', () => {
    // Séance 20 km → tol = max(5, 2) = 5 km. Activité 24 km → écart 4 → OK.
    const sessions = [makeSession({ distance: 20, elevation: 0 })]
    const activities = [makeActivity({ distanceKm: 24, elevationM: 0 })]
    expect(matchSessionsToActivities(sessions, activities, catalog).size).toBe(1)
  })

  it('rejet si distance hors tolérance', () => {
    // Séance 20 km → tol = 5 km. Activité 26 km → écart 6 → rejet.
    const sessions = [makeSession({ distance: 20, elevation: 0 })]
    const activities = [makeActivity({ distanceKm: 26, elevationM: 0 })]
    expect(matchSessionsToActivities(sessions, activities, catalog).size).toBe(0)
  })

  it('plancher distance 2 km pour les petites séances', () => {
    // Séance 5 km → tol relative = 1.25 km → plancher 2 km. Activité 7 km → écart 2 → OK.
    const sessions = [makeSession({ distance: 5, elevation: 0 })]
    const activities = [makeActivity({ distanceKm: 7, elevationM: 0 })]
    expect(matchSessionsToActivities(sessions, activities, catalog).size).toBe(1)
  })

  it('séance sans distance/D+ : matche n\'importe quelle activité du même jour + même cat', () => {
    const sessions = [makeSession({ distance: undefined, elevation: undefined, type: 'renfo' })]
    const activities = [makeActivity({ sportType: 'WeightTraining', distanceKm: 0, elevationM: 0 })]
    const map = matchSessionsToActivities(sessions, activities, catalog)
    expect(map.get('sess-1')).toEqual(['act-1'])
  })

  it('affectation 1:1 — 2 séances similaires, prend la plus proche en distance', () => {
    const sessions = [
      makeSession({ id: 'sess-A', distance: 10, elevation: 200, title: 'A' }),
      makeSession({ id: 'sess-B', distance: 20, elevation: 400, title: 'B' }),
    ]
    const activities = [
      makeActivity({ id: 'act-X', distanceKm: 10.5, elevationM: 210 }),
      makeActivity({ id: 'act-Y', distanceKm: 19.5, elevationM: 390 }),
    ]
    const map = matchSessionsToActivities(sessions, activities, catalog)
    expect(map.get('sess-A')).toEqual(['act-X'])
    expect(map.get('sess-B')).toEqual(['act-Y'])
  })

  it('1:1 — 1 activité ne peut pas matcher 2 séances', () => {
    const sessions = [
      makeSession({ id: 'sess-A', distance: 10, elevation: 200 }),
      makeSession({ id: 'sess-B', distance: 10, elevation: 200 }),
    ]
    const activities = [makeActivity({ id: 'act-X', distanceKm: 10, elevationM: 200 })]
    const map = matchSessionsToActivities(sessions, activities, catalog)
    expect(map.size).toBe(1)
  })

  it('rejectedPairs supprime la paire du matching', () => {
    const sessions = [makeSession({ id: 'sess-A' })]
    const activities = [makeActivity({ id: 'act-X' })]
    const rejected = new Set(['sess-A|act-X'])
    const map = matchSessionsToActivities(sessions, activities, catalog, rejected)
    expect(map.size).toBe(0)
  })

  it('rejectedPairs ne supprime QUE la paire ciblée — autre activité OK', () => {
    const sessions = [makeSession({ id: 'sess-A' })]
    const activities = [
      makeActivity({ id: 'act-X', distanceKm: 25, elevationM: 800 }),
      makeActivity({ id: 'act-Y', distanceKm: 26, elevationM: 810 }),
    ]
    const rejected = new Set(['sess-A|act-X'])
    const map = matchSessionsToActivities(sessions, activities, catalog, rejected)
    expect(map.get('sess-A')).toEqual(['act-Y'])
  })

  it('matche un slug custom via le catalogue', () => {
    const customCatalog: ActivityType[] = [{
      id: 'c-1',
      slug: 'cardio-perso',
      label: 'Cardio perso',
      defaultIntensity: 3,
      category: 'run',
      isSystem: false,
    }]
    const sessions = [makeSession({ type: 'cardio-perso' })]
    const activities = [makeActivity()]
    const map = matchSessionsToActivities(sessions, activities, customCatalog)
    expect(map.get('sess-1')).toEqual(['act-1'])
  })

  // ─── Cumul aller+retour (runtaf / velotaf) ──────────────────────────────
  describe('cumul aller+retour (runtaf / velotaf)', () => {
    it('runtaf 10 km cumul : 2 activités de 5 km → match cumulé', () => {
      const sessions = [makeSession({
        type: 'runtaf', distance: 10, elevation: 0, title: 'RT trajet x2',
      })]
      const activities = [
        makeActivity({ id: 'aller',  sportType: 'Run', distanceKm: 5, elevationM: 0 }),
        makeActivity({ id: 'retour', sportType: 'Run', distanceKm: 5, elevationM: 0 }),
      ]
      const map = matchSessionsToActivities(sessions, activities, catalog)
      const matched = map.get('sess-1')
      expect(matched).toBeDefined()
      expect(matched).toHaveLength(2)
      expect(matched).toEqual(expect.arrayContaining(['aller', 'retour']))
    })

    it('velotaf 24 km cumul : 2 activités vélo 12 km → match cumulé', () => {
      const sessions = [makeSession({
        type: 'velotaf', distance: 24, elevation: 0,
      })]
      const activities = [
        makeActivity({ id: 'aller',  sportType: 'Ride', distanceKm: 12, elevationM: 0 }),
        makeActivity({ id: 'retour', sportType: 'Ride', distanceKm: 12, elevationM: 0 }),
      ]
      const map = matchSessionsToActivities(sessions, activities, catalog)
      expect(map.get('sess-1')).toHaveLength(2)
    })

    it('runtaf cumul rejeté si une seule activité (moitié) — pas de match', () => {
      const sessions = [makeSession({
        type: 'runtaf', distance: 10, elevation: 0,
      })]
      const activities = [
        makeActivity({ id: 'aller', sportType: 'Run', distanceKm: 5, elevationM: 0 }),
      ]
      const map = matchSessionsToActivities(sessions, activities, catalog)
      // Single activité 5 km vs cible 10 km : tol = max(2.5, 2) = 2.5 → écart 5 → rejet.
      expect(map.size).toBe(0)
    })

    it('runtaf : 1 activité qui matche le total (one-shot) reste valide', () => {
      const sessions = [makeSession({
        type: 'runtaf', distance: 10, elevation: 0,
      })]
      const activities = [
        makeActivity({ id: 'one-shot', sportType: 'Run', distanceKm: 10, elevationM: 0 }),
      ]
      const map = matchSessionsToActivities(sessions, activities, catalog)
      expect(map.get('sess-1')).toEqual(['one-shot'])
    })

    it('séance NON-cumulative : on n\'essaie PAS de cumul (footing 10 km + 2 activités 5 km → pas de match)', () => {
      const sessions = [makeSession({
        type: 'footing', distance: 10, elevation: 0,
      })]
      const activities = [
        makeActivity({ id: 'a', sportType: 'Run', distanceKm: 5, elevationM: 0 }),
        makeActivity({ id: 'b', sportType: 'Run', distanceKm: 5, elevationM: 0 }),
      ]
      // Footing n'est pas dans CUMULATIVE_TYPES : pas de tentative cumul.
      // Chaque activité seule (5 km) vs cible 10 km : écart 5 > tol 2.5 → rejet single aussi.
      const map = matchSessionsToActivities(sessions, activities, catalog)
      expect(map.size).toBe(0)
    })

    it('runtaf cumul : meilleure paire (somme exacte) > paire approximative', () => {
      const sessions = [makeSession({
        type: 'runtaf', distance: 10, elevation: 0,
      })]
      const activities = [
        makeActivity({ id: 'a', sportType: 'Run', distanceKm: 5, elevationM: 0 }),
        makeActivity({ id: 'b', sportType: 'Run', distanceKm: 5, elevationM: 0 }),
        makeActivity({ id: 'c', sportType: 'Run', distanceKm: 7, elevationM: 0 }),
      ]
      // Paire a+b = 10 (score 0) vs a+c = 12 (écart 2). a+b doit gagner.
      const matched = matchSessionsToActivities(sessions, activities, catalog).get('sess-1')!
      expect(matched).toHaveLength(2)
      expect(matched).toEqual(expect.arrayContaining(['a', 'b']))
    })

    it('runtaf cumul : activités déjà utilisées par une autre séance ne sont pas reprises', () => {
      const sessions = [
        makeSession({ id: 'rtf',  type: 'runtaf',  distance: 10, elevation: 0, date: '2026-05-20' }),
        makeSession({ id: 'long', type: 'sortie_longue', distance: 5, elevation: 0, date: '2026-05-20' }),
      ]
      const activities = [
        // Activité parfaite pour la sortie longue (score = 0)
        makeActivity({ id: 'a', sportType: 'Run', distanceKm: 5, elevationM: 0 }),
        makeActivity({ id: 'b', sportType: 'Run', distanceKm: 5, elevationM: 0 }),
      ]
      // 'long' va prendre 'a' (score 0) en single. 'rtf' devrait essayer cumul a+b
      // mais 'a' est pris → tente single 'b' (5 km vs 10 km cible → rejet).
      const map = matchSessionsToActivities(sessions, activities, catalog)
      expect(map.get('long')).toEqual(['a'])
      expect(map.has('rtf')).toBe(false)
    })
  })
})
