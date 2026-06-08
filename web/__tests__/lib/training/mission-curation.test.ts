import { curateTemplatesForMission } from '@/lib/training/mission-curation'
import { SESSION_TEMPLATES } from '@/lib/training/session-templates'

describe('curateTemplatesForMission', () => {
  it('épingle la séance clé en tête pour trail', () => {
    expect(curateTemplatesForMission(SESSION_TEMPLATES, 'trail')[0].id).toBe('co-4x4min')
  })
  it('épingle la séance clé en tête pour route', () => {
    expect(curateTemplatesForMission(SESSION_TEMPLATES, 'route')[0].id).toBe('se-2x20')
  })
  it('priorise les types pertinents trail (cotes) avant le cross-training (velo)', () => {
    const out = curateTemplatesForMission(SESSION_TEMPLATES, 'trail')
    expect(out.findIndex(t => t.type === 'cotes')).toBeLessThan(out.findIndex(t => t.type === 'velo'))
  })
  it('retourne la liste inchangée (même réf) pour charge / libre / null', () => {
    expect(curateTemplatesForMission(SESSION_TEMPLATES, 'charge')).toBe(SESSION_TEMPLATES)
    expect(curateTemplatesForMission(SESSION_TEMPLATES, 'libre')).toBe(SESSION_TEMPLATES)
    expect(curateTemplatesForMission(SESSION_TEMPLATES, null)).toBe(SESSION_TEMPLATES)
  })
  it('ne perd ni ne duplique aucun template', () => {
    const out = curateTemplatesForMission(SESSION_TEMPLATES, 'route')
    expect(out).toHaveLength(SESSION_TEMPLATES.length)
    expect(new Set(out.map(t => t.id)).size).toBe(SESSION_TEMPLATES.length)
  })
})
