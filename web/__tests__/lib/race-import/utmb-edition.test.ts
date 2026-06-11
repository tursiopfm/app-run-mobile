import { extractUtmbEditionDate } from '@/lib/race-import/sources/utmb'

describe('extractUtmbEditionDate', () => {
  it('lit startDateIso → date ISO', () => {
    const html = 'x{"foo":1,"startDateIso":"2026-08-28T17:45:00","bar":2}y'
    expect(extractUtmbEditionDate(html)).toBe('2026-08-28')
  })
  it('fallback startDate si pas de startDateIso', () => {
    const html = '...."startDate":"2025-08-29T18:00:00"....'
    expect(extractUtmbEditionDate(html)).toBe('2025-08-29')
  })
  it('absent → null', () => {
    expect(extractUtmbEditionDate('<html>rien</html>')).toBeNull()
  })
})
