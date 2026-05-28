// web/__tests__/activities/commute.test.ts
import {
  type CommuteRoute,
  buildCommuteTitle,
  extractCommuteGeo,
  haversineMeters,
  matchCommute,
  parseCommuteSeq,
} from '@/lib/activities/commute'

// Trajet de référence : Paris (home) → ~5 km à l'est (office).
const HOME: [number, number] = [48.8566, 2.3522]
const OFFICE: [number, number] = [48.8606, 2.4200] // ~5 km plus à l'est

function makeRoute(overrides: Partial<CommuteRoute> = {}): CommuteRoute {
  return {
    id: 'r1',
    userId: 'u1',
    sportType: 'Run',
    label: 'Runtaf',
    refDistanceM: 5000,
    distanceTolPct: 12,
    homeLat: HOME[0],
    homeLng: HOME[1],
    officeLat: OFFICE[0],
    officeLng: OFFICE[1],
    geoTolM: 250,
    outboundTitle: '🏠 Home🏃‍♂️➡️🏃Office 🏢',
    returnTitle: '🏢 Office🏃‍♂️➡️🏃Home 🏠',
    hourSplit: 14,
    active: true,
    ...overrides,
  }
}

describe('haversineMeters', () => {
  it('retourne 0 pour deux points identiques', () => {
    expect(haversineMeters(HOME, HOME)).toBe(0)
  })

  it('ordre de grandeur connu (~5 km entre home et office)', () => {
    const d = haversineMeters(HOME, OFFICE)
    expect(d).toBeGreaterThan(4500)
    expect(d).toBeLessThan(5500)
  })

  it('~111 km pour 1° de latitude', () => {
    const d = haversineMeters([0, 0], [1, 0])
    expect(d).toBeGreaterThan(110000)
    expect(d).toBeLessThan(112000)
  })
})

describe('extractCommuteGeo', () => {
  it('payload complet', () => {
    const geo = extractCommuteGeo({
      distance: 5100,
      start_latlng: [48.8566, 2.3522],
      end_latlng: [48.8606, 2.42],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    expect(geo.distanceM).toBe(5100)
    expect(geo.start).toEqual([48.8566, 2.3522])
    expect(geo.end).toEqual([48.8606, 2.42])
    expect(geo.localHour).toBe(7)
  })

  it('latlng vide → null', () => {
    const geo = extractCommuteGeo({
      distance: 5100,
      start_latlng: [],
      end_latlng: [],
      start_date_local: '2026-05-28T18:10:00Z',
    })
    expect(geo.start).toBeNull()
    expect(geo.end).toBeNull()
    expect(geo.localHour).toBe(18)
  })

  it('champs manquants → tout null', () => {
    const geo = extractCommuteGeo({})
    expect(geo.distanceM).toBeNull()
    expect(geo.start).toBeNull()
    expect(geo.end).toBeNull()
    expect(geo.localHour).toBeNull()
  })

  it('rawPayload null/non-objet → tout null', () => {
    const geo = extractCommuteGeo(null)
    expect(geo.distanceM).toBeNull()
    expect(geo.start).toBeNull()
  })
})

describe('matchCommute', () => {
  it('match géo aller (départ proche de home)', () => {
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [48.8566, 2.3522],
      end_latlng: [48.8606, 2.42],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    const m = matchCommute({ sportType: 'Run', geo }, [makeRoute()])
    expect(m).not.toBeNull()
    expect(m?.direction).toBe('outbound')
  })

  it('match géo retour (départ proche de office)', () => {
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [48.8606, 2.42],
      end_latlng: [48.8566, 2.3522],
      start_date_local: '2026-05-28T18:10:00Z',
    })
    const m = matchCommute({ sportType: 'Run', geo }, [makeRoute()])
    expect(m).not.toBeNull()
    expect(m?.direction).toBe('return')
  })

  it('distance hors tolérance → null', () => {
    const geo = extractCommuteGeo({
      distance: 9000, // +80% > 12%
      start_latlng: [48.8566, 2.3522],
      end_latlng: [48.8606, 2.42],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    expect(matchCommute({ sportType: 'Run', geo }, [makeRoute()])).toBeNull()
  })

  it('route avec géo + activité SANS GPS → null (pas de fallback heure)', () => {
    // Sans le strict, un treadmill 5 km à 8 h serait classé Runtaf aller.
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [],
      end_latlng: [],
      start_date_local: '2026-05-28T08:00:00Z',
    })
    expect(matchCommute({ sportType: 'Run', geo }, [makeRoute()])).toBeNull()
  })

  it('route avec géo + départ GPS loin de home/office → null (pas de fallback heure)', () => {
    // Régression #1 : un footing matinal à l'autre bout de la ville ne doit pas être Runtaf.
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [48.9000, 2.5000], // ~9 km de home, ~6 km de office → > geoTolM
      end_latlng: [48.9100, 2.5100],
      start_date_local: '2026-05-28T08:00:00Z',
    })
    expect(matchCommute({ sportType: 'Run', geo }, [makeRoute()])).toBeNull()
  })

  it('route sans géo (home/office null) → fallback heure (matin → outbound)', () => {
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [],
      end_latlng: [],
      start_date_local: '2026-05-28T08:00:00Z',
    })
    const route = makeRoute({ homeLat: null, homeLng: null, officeLat: null, officeLng: null })
    const m = matchCommute({ sportType: 'Run', geo }, [route])
    expect(m?.direction).toBe('outbound')
  })

  it('route sans géo (home/office null) → fallback heure (soir → return)', () => {
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [],
      end_latlng: [],
      start_date_local: '2026-05-28T18:30:00Z',
    })
    const route = makeRoute({ homeLat: null, homeLng: null, officeLat: null, officeLng: null })
    const m = matchCommute({ sportType: 'Run', geo }, [route])
    expect(m?.direction).toBe('return')
  })

  it('mauvais sport → null', () => {
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [48.8566, 2.3522],
      end_latlng: [48.8606, 2.42],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    expect(matchCommute({ sportType: 'Ride', geo }, [makeRoute()])).toBeNull()
  })

  it('ni géo concluante ni heure → null', () => {
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [0, 0], // loin de home et office
      end_latlng: [0, 0],
    })
    // pas de localHour → resolveDirection ne peut conclure
    expect(matchCommute({ sportType: 'Run', geo }, [makeRoute()])).toBeNull()
  })

  it('route inactive ignorée', () => {
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [48.8566, 2.3522],
      end_latlng: [48.8606, 2.42],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    expect(matchCommute({ sportType: 'Run', geo }, [makeRoute({ active: false })])).toBeNull()
  })

  it('sport insensible à la casse', () => {
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [48.8566, 2.3522],
      end_latlng: [48.8606, 2.42],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    const m = matchCommute({ sportType: 'run', geo }, [makeRoute({ sportType: 'Run' })])
    expect(m?.direction).toBe('outbound')
  })
})

describe('buildCommuteTitle', () => {
  it('format `2026#21 ...` outbound', () => {
    expect(buildCommuteTitle(makeRoute(), 'outbound', 2026, 21)).toBe(
      '2026#21 🏠 Home🏃‍♂️➡️🏃Office 🏢',
    )
  })

  it('utilise returnTitle en return', () => {
    expect(buildCommuteTitle(makeRoute(), 'return', 2026, 21)).toBe(
      '2026#21 🏢 Office🏃‍♂️➡️🏃Home 🏠',
    )
  })
})

describe('parseCommuteSeq', () => {
  it('extrait N du préfixe `YYYY#N`', () => {
    expect(parseCommuteSeq('2026#21 🏠 Home➡️Office', 2026)).toBe(21)
  })

  it('null si année différente', () => {
    expect(parseCommuteSeq('2025#21 ...', 2026)).toBeNull()
  })

  it('null si pas de préfixe', () => {
    expect(parseCommuteSeq('Morning Run', 2026)).toBeNull()
  })

  it('null si name null', () => {
    expect(parseCommuteSeq(null, 2026)).toBeNull()
  })
})
