import { parsePace, formatPace } from '@/lib/plan/pace-format'

describe('parsePace', () => {
  it('parses mm:ss with colon', () => {
    expect(parsePace('5:30')).toBe(330)
    expect(parsePace('4:00')).toBe(240)
    expect(parsePace('12:45')).toBe(765)
  })

  it('parses 3-4 digits without colon (auto-insert)', () => {
    expect(parsePace('530')).toBe(330)
    expect(parsePace('1245')).toBe(765)
  })

  it('returns null for empty / invalid input', () => {
    expect(parsePace('')).toBeNull()
    expect(parsePace('abc')).toBeNull()
    expect(parsePace('5:99')).toBeNull()  // seconds out of range
    expect(parsePace('99:00')).toBeNull() // minutes too high (> 30 unrealistic)
  })

  it('rejects negative or zero', () => {
    expect(parsePace('0:00')).toBeNull()
    expect(parsePace('-5:00')).toBeNull()
  })
})

describe('formatPace', () => {
  it('formats secPerKm to mm:ss', () => {
    expect(formatPace(330)).toBe('5:30')
    expect(formatPace(240)).toBe('4:00')
    expect(formatPace(765)).toBe('12:45')
  })

  it('pads single-digit seconds', () => {
    expect(formatPace(305)).toBe('5:05')
  })

  it('returns empty string for null/undefined/invalid', () => {
    expect(formatPace(null)).toBe('')
    expect(formatPace(undefined)).toBe('')
    expect(formatPace(0)).toBe('')
    expect(formatPace(-10)).toBe('')
  })
})
