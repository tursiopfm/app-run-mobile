import { resolveSessionMeta } from '@/lib/plan/session-meta'
import type { ActivityType } from '@/types/activity-types'

const customRun: ActivityType = {
  id: 'c-1',
  slug: 'trail-race-xyz',
  label: 'Trail Race',
  defaultIntensity: 3,
  category: 'run',
  isSystem: false,
}

const customOther: ActivityType = {
  id: 'c-2',
  slug: 'tennis-abc',
  label: 'Tennis',
  defaultIntensity: 2,
  category: 'other',
  isSystem: false,
}

const catalog: ActivityType[] = [customRun, customOther]

describe('resolveSessionMeta', () => {
  it('builtin running type → couleur enum + isRunning=true', () => {
    const meta = resolveSessionMeta('footing', catalog)
    expect(meta.label).toBe('Endurance Fondamentale')
    expect(meta.color).toBe('#4ADE80')
    expect(meta.category).toBe('run')
    expect(meta.isRunning).toBe(true)
    expect(meta.defaultIntensity).toBe(2)
  })

  it('builtin bike type → category=bike, isRunning=false', () => {
    const meta = resolveSessionMeta('velo', catalog)
    expect(meta.category).toBe('bike')
    expect(meta.isRunning).toBe(false)
  })

  it('custom run → label catalog, couleur grise, isRunning=true', () => {
    const meta = resolveSessionMeta('trail-race-xyz', catalog)
    expect(meta.label).toBe('Trail Race')
    expect(meta.color).toBe('#6B7280')
    expect(meta.category).toBe('run')
    expect(meta.isRunning).toBe(true)
    expect(meta.defaultIntensity).toBe(3)
  })

  it('custom other → isRunning=false', () => {
    const meta = resolveSessionMeta('tennis-abc', catalog)
    expect(meta.isRunning).toBe(false)
    expect(meta.color).toBe('#6B7280')
  })

  it('slug orphelin (ni builtin ni catalogue) → fallback no-crash', () => {
    const meta = resolveSessionMeta('zombie-slug-123', catalog)
    expect(meta.label).toBe('zombie-slug-123')
    expect(meta.color).toBe('#6B7280')
    expect(meta.category).toBe('other')
    expect(meta.isRunning).toBe(false)
    expect(meta.defaultIntensity).toBe(2)
  })

  it('catalogue vide → builtins restent OK', () => {
    const meta = resolveSessionMeta('footing', [])
    expect(meta.isRunning).toBe(true)
  })
})
