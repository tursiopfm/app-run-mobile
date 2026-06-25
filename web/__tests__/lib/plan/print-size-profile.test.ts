import { PRINT_SIZE_DEFS_PROFILE } from '@/lib/plan/print-size'

describe('PRINT_SIZE_DEFS_PROFILE', () => {
  it('couvre iphone / a5 / a4 avec une règle @page et une échelle > 0', () => {
    for (const key of ['iphone', 'a5', 'a4'] as const) {
      const def = PRINT_SIZE_DEFS_PROFILE[key]
      expect(def.pageRule).toContain('size:')
      expect(def.scale).toBeGreaterThan(0)
    }
  })

  it('A4 paysage est la plus grande échelle', () => {
    expect(PRINT_SIZE_DEFS_PROFILE.a4.scale).toBeGreaterThan(PRINT_SIZE_DEFS_PROFILE.a5.scale)
    expect(PRINT_SIZE_DEFS_PROFILE.a5.scale).toBeGreaterThan(PRINT_SIZE_DEFS_PROFILE.iphone.scale)
    expect(PRINT_SIZE_DEFS_PROFILE.a4.pageRule).toContain('landscape')
  })
})
