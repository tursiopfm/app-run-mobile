import type { Phase } from '@/types/plan'

// ─── Mock Supabase ────────────────────────────────────────────────────────────
// Le module mesocycle-weeks.ts appelle createClient() puis enchaîne :
//   .from(table).select(...).eq(...) / .insert(rows) / .upsert(rows) / .delete().lt(...)
// Le mock retourne une chaîne fluent dont chaque méthode est inspectable.

type FakeRow = {
  id: string
  phase_id: string
  week_index: number
  week_start_date: string
  week_type: string
  target_load_tss: number
  target_volume_km: number
  target_dplus_m: number
  comment: string | null
  is_manual_override: boolean
  generated_from_pattern: boolean
}

let fakeDb: FakeRow[] = []
const calls = {
  upserts: [] as FakeRow[][],
  deletes: [] as Array<{ phase_id: string; gte_week_index?: number }>,
}

function makeFluent(rows: FakeRow[]) {
  const builder: any = {}
  builder.select = jest.fn().mockImplementation(() => builder)
  builder.eq = jest.fn().mockImplementation(() => builder)
  builder.order = jest.fn().mockResolvedValue({ data: rows, error: null })
  builder.lt = jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null }))
  builder.upsert = jest.fn().mockImplementation((insertedRows: FakeRow[]) => {
    calls.upserts.push(insertedRows)
    // Simule l'UPSERT : remplace les rows existantes (même phase_id + week_index).
    for (const r of insertedRows) {
      fakeDb = fakeDb.filter(x => !(x.phase_id === r.phase_id && x.week_index === r.week_index))
      fakeDb.push(r)
    }
    return Promise.resolve({ data: insertedRows, error: null })
  })
  builder.delete = jest.fn().mockImplementation(() => builder)
  return builder
}

jest.mock('@/lib/database/supabase-client', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'athlete-1' } } }) },
    from: jest.fn().mockImplementation((table: string) => {
      if (table !== 'mesocycle_weeks') throw new Error('Unexpected table: ' + table)
      const rowsForRead = [...fakeDb].sort((a, b) => a.week_index - b.week_index)
      const builder = makeFluent(rowsForRead)
      // delete(...).eq(...).gte(...) → enregistrer l'appel et appliquer.
      builder.delete = jest.fn().mockReturnValue({
        eq: (_col: string, phaseId: string) => ({
          gte: (_col2: string, weekIndex: number) => {
            calls.deletes.push({ phase_id: phaseId, gte_week_index: weekIndex })
            fakeDb = fakeDb.filter(r => !(r.phase_id === phaseId && r.week_index >= weekIndex))
            return Promise.resolve({ data: null, error: null })
          },
        }),
      })
      return builder
    }),
  })),
}))

// ─── Imports APRÈS le jest.mock pour qu'il prenne effet ───────────────────────
import { regenerateWeeks } from '@/lib/training/mesocycle-weeks'

beforeEach(() => {
  fakeDb = []
  calls.upserts = []
  calls.deletes = []
})

const phaseFixture = (overrides?: Partial<Phase>): Phase => ({
  id: 'phase-1',
  type: 'developpement',
  label: 'Cycle Développement',
  startDate: '2026-06-01',
  endDate: '2026-06-29',   // 4 semaines
  weeklyChargeTarget: 500,
  weeklyDistanceKmTarget: 60,
  weeklyElevationMTarget: 1500,
  loadPattern: 'progressive_3_1',
  ...overrides,
})

describe('regenerateWeeks — cas nominal (aucun override)', () => {
  it('UPSERT 4 rows pour une phase progressive_3_1 de 4 semaines', async () => {
    const result = await regenerateWeeks(phaseFixture())

    expect(result).toHaveLength(4)
    expect(calls.upserts).toHaveLength(1)
    expect(calls.upserts[0]).toHaveLength(4)
    expect(result.map(w => w.weekType)).toEqual(['load', 'load', 'load', 'deload'])
    expect(result[3].targetLoadTss).toBe(325)   // 500 * 0.65
  })
})

describe('regenerateWeeks — préservation des overrides', () => {
  it('préserve une semaine is_manual_override=true par défaut', async () => {
    // Pré-remplir avec une row override sur week_index=2.
    fakeDb = [{
      id: 'pre-existing',
      phase_id: 'phase-1',
      week_index: 2,
      week_start_date: '2026-06-15',
      week_type: 'custom',
      target_load_tss: 999,           // valeur custom de l'utilisateur
      target_volume_km: 99,
      target_dplus_m: 9999,
      comment: 'ma semaine custom',
      is_manual_override: true,
      generated_from_pattern: false,
    }]

    const result = await regenerateWeeks(phaseFixture())
    const week2 = result.find(w => w.weekIndex === 2)
    expect(week2).toBeDefined()
    expect(week2!.isManualOverride).toBe(true)
    expect(week2!.targetLoadTss).toBe(999)         // pas écrasée
    expect(week2!.weekType).toBe('custom')         // pas écrasée
    // Les 3 autres rows ont bien été générées.
    expect(calls.upserts[0]).toHaveLength(3)
    expect(calls.upserts[0].every(r => r.week_index !== 2)).toBe(true)
  })

  it('écrase tout avec forceOverwrite=true (y compris override)', async () => {
    fakeDb = [{
      id: 'pre-existing',
      phase_id: 'phase-1',
      week_index: 2,
      week_start_date: '2026-06-15',
      week_type: 'custom',
      target_load_tss: 999,
      target_volume_km: 99,
      target_dplus_m: 9999,
      comment: 'ma semaine custom',
      is_manual_override: true,
      generated_from_pattern: false,
    }]

    const result = await regenerateWeeks(phaseFixture(), { forceOverwrite: true })
    const week2 = result.find(w => w.weekIndex === 2)
    expect(week2!.isManualOverride).toBe(false)
    expect(week2!.targetLoadTss).toBe(500)         // 500 * 1.00 (load 100% du cycle 3_1)
    expect(calls.upserts[0]).toHaveLength(4)        // toutes les 4 sont upsertées
  })
})
