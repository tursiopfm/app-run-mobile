import {
  guessIntensity,
  guessWorkoutType,
  secondsToHMS,
  hmsToSeconds,
  INTENSITY_OPTIONS,
  SPORT_OPTIONS,
  type WorkoutType,
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

// guessIntensity pure HR signature: (avgHr?, hrZones?) — no keywords, no name/sport

describe('guessIntensity — HR zone fallback', () => {
  const zones = calculateHrZones({ method: 'karvonen', maxHr: 195, restingHr: 57 }).zones
  // Z1: null–140  Z2: 141–154  Z3: 155–167  Z4: 168–181  Z5: 182–195

  it('Z1 → recuperation', () => {
    expect(guessIntensity(120, zones)).toBe('recuperation')
    expect(guessIntensity(140, zones)).toBe('recuperation')
  })
  it('Z2 → footing', () => {
    expect(guessIntensity(148, zones)).toBe('footing')
    expect(guessIntensity(154, zones)).toBe('footing')
  })
  it('Z3 → endurance_active', () => {
    expect(guessIntensity(160, zones)).toBe('endurance_active')
    expect(guessIntensity(167, zones)).toBe('endurance_active')
  })
  it('Z4 → seuil', () => {
    expect(guessIntensity(174, zones)).toBe('seuil')
    expect(guessIntensity(181, zones)).toBe('seuil')
  })
  it('Z5 → vma', () => {
    expect(guessIntensity(188, zones)).toBe('vma')
  })
  it('returns null when avgHr is null', () => {
    expect(guessIntensity(null, zones)).toBeNull()
  })
  it('returns null when hrZones is empty', () => {
    expect(guessIntensity(148, [])).toBeNull()
  })
  it('returns null when no arguments', () => {
    expect(guessIntensity()).toBeNull()
  })
})

describe('guessWorkoutType', () => {
  it('fractionné/VMA keywords → fractionne', () => {
    expect(guessWorkoutType('VMA 400m x8', 'Run')).toBe('fractionne')
    expect(guessWorkoutType('Séance fractionné 200m', 'Run')).toBe('fractionne')
    expect(guessWorkoutType('Intervals 1000m', 'Run')).toBe('fractionne')
  })
  it('côtes keywords → cotes', () => {
    expect(guessWorkoutType('Côtes 200m', 'Run')).toBe('cotes')
    expect(guessWorkoutType('Montée répétées', 'Run')).toBe('cotes')
    expect(guessWorkoutType("Côte d'Igny", 'TrailRun')).toBe('cotes')
    expect(guessWorkoutType('Hill repeats', 'Run')).toBe('cotes')
  })
  it('competition keywords → course', () => {
    expect(guessWorkoutType('Race 10k Lyon', 'Run')).toBe('course')
    expect(guessWorkoutType('Semi-marathon Paris', 'Run')).toBe('course')
    expect(guessWorkoutType('Marathon du Médoc', 'Run')).toBe('course')
    expect(guessWorkoutType('Compétition trail', 'TrailRun')).toBe('course')
    expect(guessWorkoutType('Dossard 1234 course', 'Run')).toBe('course')
  })
  it('"course à pied" is NOT a competition', () => {
    expect(guessWorkoutType('Course à pied matinale', 'Run')).not.toBe('course')
    expect(guessWorkoutType('course à pied facile', 'Run')).not.toBe('course')
  })
  it('"10k" alone → course', () => {
    expect(guessWorkoutType('10k facile', 'Run')).toBe('course')
  })
  it('sortie longue keywords → sortie_longue', () => {
    expect(guessWorkoutType('Sortie longue dimanche', 'Run')).toBe('sortie_longue')
    expect(guessWorkoutType('SL 2h trail', 'TrailRun')).toBe('sortie_longue')
    expect(guessWorkoutType('Long run 30k', 'Run')).toBe('sortie_longue')
    expect(guessWorkoutType('LSL du dimanche', 'Run')).toBe('sortie_longue')
  })
  it('runtaf keywords → runtaf', () => {
    expect(guessWorkoutType('Runtaf maison', 'Run')).toBe('runtaf')
    expect(guessWorkoutType('Taf à pied', 'Run')).toBe('runtaf')
    expect(guessWorkoutType('run taf', 'Run')).toBe('runtaf')
  })
  it('velotaf keywords → velotaf', () => {
    expect(guessWorkoutType('Vélotaf boulot', 'Ride')).toBe('velotaf')
    expect(guessWorkoutType('Taf en vélo', 'Ride')).toBe('velotaf')
    expect(guessWorkoutType('Home 🚴🏻', 'Ride')).toBe('velotaf')
  })
  it('default → null (no matching type)', () => {
    expect(guessWorkoutType('Sortie du matin', 'Run')).toBeNull()
    expect(guessWorkoutType('Footing matinal', 'Run')).toBeNull()
  })
})

describe('INTENSITY_OPTIONS', () => {
  it('has 5 entries (pure physiological zones only)', () => {
    expect(INTENSITY_OPTIONS).toHaveLength(5)
  })
})

describe('SPORT_OPTIONS', () => {
  it('has 10 entries', () => {
    expect(SPORT_OPTIONS).toHaveLength(10)
  })
})
