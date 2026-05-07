import { formatRelativeTime, lastLoginColor } from '@/lib/admin/format'

describe('formatRelativeTime', () => {
  it('retourne "aujourd\'hui" pour une date < 1 heure', () => {
    const d = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    expect(formatRelativeTime(d)).toBe("aujourd'hui")
  })

  it('retourne "hier" pour une date entre 24h et 48h', () => {
    const d = new Date(Date.now() - 36 * 3600 * 1000).toISOString()
    expect(formatRelativeTime(d)).toBe('hier')
  })

  it('retourne "il y a N jours" pour une date > 48h', () => {
    const d = new Date(Date.now() - 5 * 86400 * 1000).toISOString()
    expect(formatRelativeTime(d)).toBe('il y a 5 jours')
  })

  it('retourne "—" pour null', () => {
    expect(formatRelativeTime(null)).toBe('—')
  })
})

describe('lastLoginColor', () => {
  it('retourne green pour connexion < 3 jours', () => {
    const d = new Date(Date.now() - 1 * 86400 * 1000).toISOString()
    expect(lastLoginColor(d)).toBe('text-trail-success')
  })

  it('retourne warning pour connexion > 3 jours', () => {
    const d = new Date(Date.now() - 10 * 86400 * 1000).toISOString()
    expect(lastLoginColor(d)).toBe('text-trail-warning')
  })

  it('retourne muted pour null', () => {
    expect(lastLoginColor(null)).toBe('text-trail-muted')
  })
})
