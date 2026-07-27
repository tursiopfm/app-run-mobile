import { lastSeenAt } from '@/lib/admin/format'

describe('lastSeenAt', () => {
  it('retourne updated_at quand la session a été renouvelée après le dernier sign-in', () => {
    expect(lastSeenAt('2026-07-08T19:02:24Z', '2026-07-27T14:59:19Z')).toBe('2026-07-27T14:59:19Z')
  })

  it('retourne last_sign_in_at quand il est plus récent', () => {
    expect(lastSeenAt('2026-07-12T06:27:57Z', '2026-06-10T14:16:05Z')).toBe('2026-07-12T06:27:57Z')
  })

  it('tolère une valeur manquante', () => {
    expect(lastSeenAt(null, '2026-07-20T15:23:25Z')).toBe('2026-07-20T15:23:25Z')
    expect(lastSeenAt('2026-07-20T15:23:25Z', undefined)).toBe('2026-07-20T15:23:25Z')
    expect(lastSeenAt(null, undefined)).toBeNull()
  })
})
