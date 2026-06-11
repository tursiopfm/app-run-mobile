import { parseLivetrailStart, extractYearFromLivetrailUrl } from '@/lib/race-import/sources/livetrail'

describe('parseLivetrailStart', () => {
  it('DD-HH:MM → { day, time }', () => {
    expect(parseLivetrailStart('12-19:10')).toEqual({ day: 12, time: '19:10' })
  })
  it('vide / invalide → null', () => {
    expect(parseLivetrailStart('')).toBeNull()
    expect(parseLivetrailStart(undefined)).toBeNull()
    expect(parseLivetrailStart('bogus')).toBeNull()
  })
})

describe('extractYearFromLivetrailUrl', () => {
  it('URL v3 avec /YYYY/ → année', () => {
    expect(extractYearFromLivetrailUrl('https://tsj.v3.livetrail.net/fr/2026/races/Ultra')).toBe(2026)
  })
  it('parcours.php sans année → null', () => {
    expect(extractYearFromLivetrailUrl('https://tsj.livetrail.run/parcours.php?course=Ultra')).toBeNull()
  })
  it('URL invalide → null', () => {
    expect(extractYearFromLivetrailUrl('pas-une-url')).toBeNull()
  })
})
