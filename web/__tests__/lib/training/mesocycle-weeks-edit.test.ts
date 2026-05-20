import type { MesocycleWeek } from '@/types/plan'

// ─── Mock Supabase aligné avec mesocycle-weeks.test.ts existant ────────────
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
  updates: [] as Array<{ id: string; patch: Partial<FakeRow> }>,
}

jest.mock('@/lib/database/supabase-client', () => ({
  createClient: jest.fn().mockImplementation(() => {
    return {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'athlete-1' } } }) },
      from: jest.fn().mockImplementation((table: string) => {
        if (table !== 'mesocycle_weeks') throw new Error('Unexpected table: ' + table)
        const builder: any = {
          update: jest.fn().mockImplementation((patch: Partial<FakeRow>) => {
            return {
              eq: (_col: string, weekId: string) => {
                calls.updates.push({ id: weekId, patch })
                const idx = fakeDb.findIndex(r => r.id === weekId)
                if (idx < 0) return {
                  select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
                }
                fakeDb[idx] = { ...fakeDb[idx], ...patch }
                return {
                  select: () => ({
                    maybeSingle: () => Promise.resolve({ data: fakeDb[idx], error: null }),
                  }),
                }
              },
            }
          }),
        }
        return builder
      }),
    }
  }),
}))

import { updateWeek } from '@/lib/training/mesocycle-weeks'

beforeEach(() => {
  fakeDb = []
  calls.updates = []
})

const baseRow: FakeRow = {
  id: 'w1',
  phase_id: 'phase-1',
  week_index: 0,
  week_start_date: '2026-06-01',
  week_type: 'load',
  target_load_tss: 400,
  target_volume_km: 50,
  target_dplus_m: 1000,
  comment: null,
  is_manual_override: false,
  generated_from_pattern: true,
}

describe('updateWeek', () => {
  it('patch km uniquement → force is_manual_override=true et generated_from_pattern=false', async () => {
    fakeDb = [{ ...baseRow }]
    const result = await updateWeek('w1', { targetVolumeKm: 65 })
    expect(result).not.toBeNull()
    expect(result!.targetVolumeKm).toBe(65)
    expect(result!.isManualOverride).toBe(true)
    expect(result!.generatedFromPattern).toBe(false)
    // Les autres champs sont préservés (target_load_tss reste 400, weekType reste 'load')
    expect(result!.targetLoadTss).toBe(400)
    expect(result!.weekType).toBe('load')
    // Le patch envoyé à Supabase contient bien is_manual_override forcé.
    expect(calls.updates[0].patch.is_manual_override).toBe(true)
    expect(calls.updates[0].patch.generated_from_pattern).toBe(false)
  })

  it('patch weekType → row UPDATE avec override true', async () => {
    fakeDb = [{ ...baseRow }]
    const result = await updateWeek('w1', { weekType: 'deload' })
    expect(result).not.toBeNull()
    expect(result!.weekType).toBe('deload')
    expect(result!.isManualOverride).toBe(true)
  })

  it('weekId inexistant → retourne null sans throw', async () => {
    fakeDb = []   // pas de row
    const result = await updateWeek('does-not-exist', { targetVolumeKm: 99 })
    expect(result).toBeNull()
  })
})
