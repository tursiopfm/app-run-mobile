import {
  guessIntensity,
  secondsToHMS,
  hmsToSeconds,
  INTENSITY_OPTIONS,
  SPORT_OPTIONS,
} from '@/lib/activities/intensity'

describe('secondsToHMS', () => {
  it('converts seconds to h:mm:ss', () => {
    expect(secondsToHMS(4920)).toBe('1:22:00')
    expect(secondsToHMS(3600)).toBe('1:00:00')
    expect(secondsToHMS(90)).toBe('0:01:30')
    expect(secondsToHMS(0)).toBe('0:00:00')
  })
})

describe('hmsToSeconds', () => {
  it('parses h:mm:ss to seconds', () => {
    expect(hmsToSeconds('1:22:00')).toBe(4920)
    expect(hmsToSeconds('0:01:30')).toBe(90)
    expect(hmsToSeconds('1:00:00')).toBe(3600)
  })
  it('returns null for invalid format', () => {
    expect(hmsToSeconds('82:00')).toBeNull()
    expect(hmsToSeconds('abc')).toBeNull()
    expect(hmsToSeconds('')).toBeNull()
  })
})

describe('guessIntensity', () => {
  it('detects footing keywords', () => {
    expect(guessIntensity('Footing matinal', null, 'Run')).toBe('footing')
    expect(guessIntensity('Récup légère', null, 'Run')).toBe('footing')
  })
  it('detects sortie longue keywords', () => {
    expect(guessIntensity('Sortie longue dimanche', null, 'Run')).toBe('sortie_longue')
    expect(guessIntensity('SL 2h trail', null, 'TrailRun')).toBe('sortie_longue')
  })
  it('detects côtes keywords', () => {
    expect(guessIntensity('Côtes 200m', null, 'Run')).toBe('cotes')
    expect(guessIntensity('Montée répétées', null, 'Run')).toBe('cotes')
  })
  it('detects vma keywords', () => {
    expect(guessIntensity('VMA 400m x8', null, 'Run')).toBe('vma')
    expect(guessIntensity('Séance fractionné', null, 'Run')).toBe('vma')
  })
  it('detects seuil keywords', () => {
    expect(guessIntensity('Seuil 20min', null, 'Run')).toBe('seuil')
    expect(guessIntensity('Tempo run', null, 'Run')).toBe('seuil')
  })
  it('detects runtaf by keyword and sport', () => {
    expect(guessIntensity('Runtaf maison', null, 'Run')).toBe('runtaf')
    expect(guessIntensity('Taf à pied', null, 'Run')).toBe('runtaf')
  })
  it('detects velotaf by keyword and sport', () => {
    expect(guessIntensity('Vélotaf boulot', null, 'Ride')).toBe('velotaf')
    expect(guessIntensity('Taf en vélo', null, 'Ride')).toBe('velotaf')
  })
  it('detects course keywords', () => {
    expect(guessIntensity('Course 10k Lyon', null, 'Run')).toBe('course')
    expect(guessIntensity('Semi-marathon', null, 'Run')).toBe('course')
  })
  it('falls back to CES thresholds when no keyword', () => {
    expect(guessIntensity('Sortie', 130, 'Run')).toBe('seuil')
    expect(guessIntensity('Sortie', 80, 'Run')).toBe('runtaf')
    expect(guessIntensity('Sortie', 50, 'Run')).toBe('footing')
  })
  it('returns autre when no keyword and no CES', () => {
    expect(guessIntensity('Sortie', null, 'Run')).toBe('autre')
  })
})

describe('INTENSITY_OPTIONS', () => {
  it('has 9 entries', () => {
    expect(INTENSITY_OPTIONS).toHaveLength(9)
  })
})

describe('SPORT_OPTIONS', () => {
  it('has 10 entries', () => {
    expect(SPORT_OPTIONS).toHaveLength(10)
  })
})
