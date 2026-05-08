import {
  guessIntensity,
  secondsToHMS,
  hmsToSeconds,
  INTENSITY_OPTIONS,
  SPORT_OPTIONS,
} from '@/lib/activities/intensity'
import { calculateHrZones } from '@/lib/health/hr-zones'

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
    expect(guessIntensity("Côte d'Igny - 1000m D+", null, 'TrailRun')).toBe('cotes')
    expect(guessIntensity('Montee du Puy', null, 'TrailRun')).toBe('cotes')
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

describe('guessIntensity with HR zones', () => {
  const zones = calculateHrZones({ method: 'karvonen', maxHr: 195, restingHr: 57 }).zones
  // Z1: null–140, Z2: 141–154, Z3: 155–167, Z4: 168–181, Z5: 182–195

  it('returns footing for avg_hr in Z1', () => {
    expect(guessIntensity('Sortie', null, 'Run', 120, zones)).toBe('footing')
    expect(guessIntensity('Sortie', null, 'Run', 140, zones)).toBe('footing')
  })
  it('returns footing for avg_hr in Z2', () => {
    expect(guessIntensity('Sortie', null, 'Run', 148, zones)).toBe('footing')
    expect(guessIntensity('Sortie', null, 'Run', 154, zones)).toBe('footing')
  })
  it('returns sortie_longue for avg_hr in Z3', () => {
    expect(guessIntensity('Sortie', null, 'Run', 160, zones)).toBe('sortie_longue')
    expect(guessIntensity('Sortie', null, 'Run', 167, zones)).toBe('sortie_longue')
  })
  it('returns seuil for avg_hr in Z4', () => {
    expect(guessIntensity('Sortie', null, 'Run', 174, zones)).toBe('seuil')
    expect(guessIntensity('Sortie', null, 'Run', 181, zones)).toBe('seuil')
  })
  it('returns vma for avg_hr in Z5', () => {
    expect(guessIntensity('Sortie', null, 'Run', 188, zones)).toBe('vma')
  })
  it('keywords take priority over HR zones', () => {
    expect(guessIntensity('Footing matinal', null, 'Run', 188, zones)).toBe('footing')
    expect(guessIntensity('VMA 400m', null, 'Run', 120, zones)).toBe('vma')
  })
  it('falls back to CES when avgHr is null', () => {
    expect(guessIntensity('Sortie', 130, 'Run', null, zones)).toBe('seuil')
    expect(guessIntensity('Sortie', 50, 'Run', null, zones)).toBe('footing')
  })
  it('falls back to autre when avgHr null, no zones, no CES', () => {
    expect(guessIntensity('Sortie', null, 'Run', null, [])).toBe('autre')
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
