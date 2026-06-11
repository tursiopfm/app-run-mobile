import {
  validateExtractedRaceData,
  rawToExtractedRaceData,
  RACE_EXTRACTION_JSON_SCHEMA,
  rowToRaceWaypoint,
} from '@/lib/race-import/schema'

describe('rawToExtractedRaceData (snake → camel)', () => {
  it('convertit la sortie LLM snake_case en camelCase', () => {
    const raw = {
      race_name: 'CCC',
      edition_year: 2024,
      waypoints: [
        {
          order_index: 0,
          name: 'Courmayeur',
          km: 0,
          km_inter: 0,
          d_plus: 0,
          d_moins: 0,
          cutoff_raw: '09:00',
          cutoff_kind: 'clock_time' as const,
          type: 'depart' as const,
        },
      ],
    }
    const out = rawToExtractedRaceData(raw)
    expect(out.raceName).toBe('CCC')
    expect(out.editionYear).toBe(2024)
    expect(out.waypoints[0]).toEqual({
      orderIndex: 0,
      name: 'Courmayeur',
      km: 0,
      kmInter: 0,
      dPlus: 0,
      dMoins: 0,
      cutoffRaw: '09:00',
      cutoffKind: 'clock_time',
      type: 'depart',
      supplies: [],
      targetOverrideSec: null,
    })
  })

  it('nullifie cutoffKind quand cutoffRaw est null', () => {
    const raw = {
      race_name: null,
      edition_year: null,
      waypoints: [
        {
          order_index: 0,
          name: 'Start',
          km: 0,
          km_inter: null,
          d_plus: null,
          d_moins: null,
          cutoff_raw: null,
          cutoff_kind: 'unknown' as const,
          type: 'depart' as const,
        },
      ],
    }
    const out = rawToExtractedRaceData(raw)
    expect(out.waypoints[0].cutoffRaw).toBeNull()
    expect(out.waypoints[0].cutoffKind).toBeNull()
  })
})

describe('validateExtractedRaceData', () => {
  function makeWaypoint(over: Partial<{
    orderIndex: number; km: number; type: string; name: string;
    kmInter: number | null; dPlus: number | null; dMoins: number | null;
  }>) {
    return {
      orderIndex: 0,
      name: 'A',
      km: 0,
      kmInter: null,
      dPlus: null,
      dMoins: null,
      cutoffRaw: null,
      cutoffKind: null,
      type: 'depart',
      ...over,
    } as any
  }

  it('accepte une liste vide (aucun tableau exploitable)', () => {
    expect(() =>
      validateExtractedRaceData({
        raceName: null,
        editionYear: null,
        editionDate: null,
        dateExplicit: false,
        startDayOfMonth: null,
        startTimeRaw: null,
        waypoints: [],
      }),
    ).not.toThrow()
  })

  it('rejette km non strictement croissants', () => {
    expect(() =>
      validateExtractedRaceData({
        raceName: null,
        editionYear: null,
        editionDate: null,
        dateExplicit: false,
        startDayOfMonth: null,
        startTimeRaw: null,
        waypoints: [
          makeWaypoint({ orderIndex: 0, km: 0, type: 'depart' }),
          makeWaypoint({ orderIndex: 1, name: 'B', km: 0, type: 'arrivee' }),
        ],
      }),
    ).toThrow(/km.*croissant/i)
  })

  it('rejette d_plus négatif', () => {
    expect(() =>
      validateExtractedRaceData({
        raceName: null,
        editionYear: null,
        editionDate: null,
        dateExplicit: false,
        startDayOfMonth: null,
        startTimeRaw: null,
        waypoints: [makeWaypoint({ dPlus: -10 })],
      }),
    ).toThrow(/d_plus|dPlus/i)
  })

  it("force depart/arrivee aux extrémités quand types intermédiaires fournis", () => {
    const data = {
      raceName: null,
      editionYear: null,
      editionDate: null,
      dateExplicit: false,
      startDayOfMonth: null,
      startTimeRaw: null,
      waypoints: [
        makeWaypoint({ orderIndex: 0, km: 0, type: 'ravito' }),
        makeWaypoint({ orderIndex: 1, name: 'B', km: 10, type: 'ravito' }),
      ],
    }
    const out = validateExtractedRaceData(data)
    expect(out.waypoints[0].type).toBe('depart')
    expect(out.waypoints[1].type).toBe('arrivee')
  })

  it("réindexe order_index séquentiellement à partir de 0", () => {
    const data = {
      raceName: null,
      editionYear: null,
      editionDate: null,
      dateExplicit: false,
      startDayOfMonth: null,
      startTimeRaw: null,
      waypoints: [
        makeWaypoint({ orderIndex: 5, km: 0, type: 'depart' }),
        makeWaypoint({ orderIndex: 9, name: 'B', km: 10, type: 'arrivee' }),
      ],
    }
    const out = validateExtractedRaceData(data)
    expect(out.waypoints.map(w => w.orderIndex)).toEqual([0, 1])
  })
})

describe('RACE_EXTRACTION_JSON_SCHEMA', () => {
  it("a un type 'object' à la racine avec strict: true", () => {
    expect(RACE_EXTRACTION_JSON_SCHEMA.schema.type).toBe('object')
    expect(RACE_EXTRACTION_JSON_SCHEMA.strict).toBe(true)
  })
})

describe('rowToRaceWaypoint (nouveaux champs)', () => {
  it('mappe supplies et target_override_sec', () => {
    const wp = rowToRaceWaypoint({
      id: 'w1', race_id: 'r1', order_index: 1, name: 'Ravito A',
      km: 10, km_inter: null, d_plus: 300, d_moins: 100,
      cutoff_raw: null, cutoff_kind: null, type: 'ravito',
      supplies: ['solid', 'liquid'], target_override_sec: 8000,
    })
    expect(wp.supplies).toEqual(['solid', 'liquid'])
    expect(wp.targetOverrideSec).toBe(8000)
  })

  it('défauts : supplies absent → [], override absent → null', () => {
    const wp = rowToRaceWaypoint({
      id: 'w2', race_id: 'r1', order_index: 0, name: 'Départ',
      km: 0, km_inter: null, d_plus: 0, d_moins: 0,
      cutoff_raw: null, cutoff_kind: null, type: 'depart',
    } as any)
    expect(wp.supplies).toEqual([])
    expect(wp.targetOverrideSec).toBeNull()
  })
})
