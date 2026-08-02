import {
  hourInTimeZone, dateInTimeZone, isMorningWindow, buildMorningNotification,
} from '@/lib/push/morning-message'
import type { StatusId } from '@/lib/analytics/charge-insights.types'

// Rappel : Paris = UTC+2 en été (CEST), UTC+1 en hiver (CET).
describe('fenêtre horaire', () => {
  it('convertit UTC → heure de Paris en été', () => {
    expect(hourInTimeZone(new Date('2026-08-02T05:00:00Z'))).toBe(7)
  })

  it('convertit UTC → heure de Paris en hiver', () => {
    expect(hourInTimeZone(new Date('2026-01-15T06:00:00Z'))).toBe(7)
  })

  it('gère minuit sans renvoyer 24', () => {
    expect(hourInTimeZone(new Date('2026-08-02T22:00:00Z'))).toBe(0)
  })

  it.each([
    ['été   06:59', '2026-08-02T04:59:00Z', false],
    ['été   07:00', '2026-08-02T05:00:00Z', true],
    ['été   09:59', '2026-08-02T07:59:00Z', true],
    ['été   10:00', '2026-08-02T08:00:00Z', false],
    ['hiver 06:59', '2026-01-15T05:59:00Z', false],
    ['hiver 07:00', '2026-01-15T06:00:00Z', true],
    ['hiver 09:59', '2026-01-15T08:59:00Z', true],
    ['hiver 10:00', '2026-01-15T09:00:00Z', false],
  ])('%s → %s', (_label, iso, expected) => {
    expect(isMorningWindow(new Date(iso))).toBe(expected)
  })
})

describe('dateInTimeZone', () => {
  it('renvoie le jour local de Paris, pas le jour UTC', () => {
    // 23:30 UTC le 2 août = 01:30 le 3 août à Paris
    expect(dateInTimeZone(new Date('2026-08-02T23:30:00Z'))).toBe('2026-08-03')
  })

  it('formate en YYYY-MM-DD avec zéros', () => {
    expect(dateInTimeZone(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05')
  })
})

describe('buildMorningNotification', () => {
  it('compose verdict + séance, sans point final au verdict', () => {
    const n = buildMorningNotification('overloaded', {
      title: 'Sortie longue', duration: 90, distance: 18,
    })
    expect(n.title).toBe('Rapport matinal')
    expect(n.body).toBe('Lève le pied 1-2 jours · Sortie longue — 1h30 · 18 km')
    expect(n.url).toBe('/rapport-matinal')
  })

  it('omet la distance quand elle est nulle', () => {
    const n = buildMorningNotification('balanced', {
      title: 'Footing', duration: 45, distance: null,
    })
    expect(n.body).toBe('Suis ton plan normalement · Footing — 0h45')
  })

  it('bascule sur le texte de repli sans séance', () => {
    const n = buildMorningNotification('very-fresh', null)
    expect(n.body).toBe('Bonne fenêtre pour intensifier · Aucune séance prévue')
  })

  it('produit un corps non vide pour chaque StatusId', () => {
    const all: StatusId[] = [
      'insufficient', 'overloaded', 'peak', 'loaded', 'under-trained',
      'very-fresh', 'light', 'progressing', 'balanced',
    ]
    for (const status of all) {
      const body = buildMorningNotification(status, null).body
      expect(body.length).toBeGreaterThan(10)
      expect(body).not.toMatch(/\.\s·/)   // pas de point avant le séparateur
    }
  })
})
