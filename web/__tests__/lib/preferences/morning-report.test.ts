import {
  MORNING_REPORT_AUTO_OPEN_KEY,
  readMorningReportAutoOpen,
  writeMorningReportAutoOpen,
} from '@/lib/preferences/morning-report'

describe('readMorningReportAutoOpen', () => {
  beforeEach(() => localStorage.clear())

  it('retourne null quand la clé est absente', () => {
    expect(readMorningReportAutoOpen()).toBeNull()
  })

  it('retourne true quand la valeur stockée est true', () => {
    localStorage.setItem(MORNING_REPORT_AUTO_OPEN_KEY, JSON.stringify(true))
    expect(readMorningReportAutoOpen()).toBe(true)
  })

  it('retourne false quand la valeur stockée est false', () => {
    localStorage.setItem(MORNING_REPORT_AUTO_OPEN_KEY, JSON.stringify(false))
    expect(readMorningReportAutoOpen()).toBe(false)
  })

  it('retourne null quand la valeur est illisible', () => {
    localStorage.setItem(MORNING_REPORT_AUTO_OPEN_KEY, 'not-json')
    expect(readMorningReportAutoOpen()).toBeNull()
  })

  it('writeMorningReportAutoOpen persiste un booléen relisible', () => {
    writeMorningReportAutoOpen(false)
    expect(readMorningReportAutoOpen()).toBe(false)
    writeMorningReportAutoOpen(true)
    expect(readMorningReportAutoOpen()).toBe(true)
  })
})
