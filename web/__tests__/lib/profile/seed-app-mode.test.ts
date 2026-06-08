import { seedAppModePreferences } from '@/lib/profile/seed-app-mode'

describe('seedAppModePreferences', () => {
  it('sème app_mode dans des préférences vides', () => {
    expect(seedAppModePreferences(null, 'mission')).toEqual({ app_mode: 'mission' })
    expect(seedAppModePreferences(undefined, 'expert')).toEqual({ app_mode: 'expert' })
  })

  it('merge sans écraser les autres clés', () => {
    const current = { cockpit_block_order: ['a', 'b'], whats_new_seen: true }
    expect(seedAppModePreferences(current, 'mission')).toEqual({
      cockpit_block_order: ['a', 'b'],
      whats_new_seen: true,
      app_mode: 'mission',
    })
  })

  it('retourne null pour un mode invalide (→ ne rien écrire)', () => {
    expect(seedAppModePreferences(null, 'libre')).toBeNull()
    expect(seedAppModePreferences(null, null)).toBeNull()
    expect(seedAppModePreferences(null, undefined)).toBeNull()
  })

  it('retourne null si app_mode est déjà défini (ne réécrase pas un choix existant)', () => {
    expect(seedAppModePreferences({ app_mode: 'expert' }, 'mission')).toBeNull()
    expect(seedAppModePreferences({ app_mode: 'mission' }, 'expert')).toBeNull()
  })
})
