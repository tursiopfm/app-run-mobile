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

// guessIntensity new signature: (name, sport, avgHr?, hrZones?) — no ces param

describe('guessIntensity — keyword priority (highest intensity wins)', () => {
  it('"footing 10x400" → vma (fractionné beats footing)', () => {
    expect(guessIntensity('Footing 10x400', 'Run')).toBe('vma')
  })
  it('"Sortie longue EF" → footing (EF keyword = footing intensity)', () => {
    expect(guessIntensity('Sortie longue EF', 'Run')).toBe('footing')
  })
  it('vma/fractionné keywords → vma', () => {
    expect(guessIntensity('VMA 400m x8', 'Run')).toBe('vma')
    expect(guessIntensity('Séance fractionné', 'Run')).toBe('vma')
    expect(guessIntensity('Intervals 1000m', 'Run')).toBe('vma')
    expect(guessIntensity('Répétitions 200m', 'Run')).toBe('vma')
    expect(guessIntensity('Repetition 800m', 'Run')).toBe('vma')
  })
  it('seuil/tempo keywords → seuil', () => {
    expect(guessIntensity('Seuil 20min', 'Run')).toBe('seuil')
    expect(guessIntensity('Tempo run', 'Run')).toBe('seuil')
    expect(guessIntensity('Threshold workout', 'Run')).toBe('seuil')
  })
  it('récup keywords → recuperation', () => {
    expect(guessIntensity('Récup légère', 'Run')).toBe('recuperation')
    expect(guessIntensity('Recovery jog', 'Run')).toBe('recuperation')
  })
  it('footing/EF keywords → footing', () => {
    expect(guessIntensity('Footing matinal', 'Run')).toBe('footing')
    expect(guessIntensity('Endurance facile', 'Run')).toBe('footing')
  })
})

describe('guessIntensity — no CES fallback', () => {
  it('no keywords + no zones → autre (not seuil)', () => {
    expect(guessIntensity('Sortie', 'Run')).toBe('autre')
  })
  it('returns autre when no keywords and no zones', () => {
    expect(guessIntensity('Sortie du matin', 'Run')).toBe('autre')
  })
})

describe('guessIntensity — HR zone fallback', () => {
  const zones = calculateHrZones({ method: 'karvonen', maxHr: 195, restingHr: 57 }).zones
  // Z1: null–140  Z2: 141–154  Z3: 155–167  Z4: 168–181  Z5: 182–195

  it('Z1 → recuperation', () => {
    expect(guessIntensity('Sortie', 'Run', 120, zones)).toBe('recuperation')
    expect(guessIntensity('Sortie', 'Run', 140, zones)).toBe('recuperation')
  })
  it('Z2 → footing', () => {
    expect(guessIntensity('Sortie', 'Run', 148, zones)).toBe('footing')
    expect(guessIntensity('Sortie', 'Run', 154, zones)).toBe('footing')
  })
  it('Z3 → endurance_active (not sortie_longue)', () => {
    expect(guessIntensity('Sortie', 'Run', 160, zones)).toBe('endurance_active')
    expect(guessIntensity('Sortie', 'Run', 167, zones)).toBe('endurance_active')
  })
  it('Z4 → seuil', () => {
    expect(guessIntensity('Sortie', 'Run', 174, zones)).toBe('seuil')
    expect(guessIntensity('Sortie', 'Run', 181, zones)).toBe('seuil')
  })
  it('Z5 → vma', () => {
    expect(guessIntensity('Sortie', 'Run', 188, zones)).toBe('vma')
  })
  it('keywords take priority over HR zones', () => {
    expect(guessIntensity('Footing matinal', 'Run', 188, zones)).toBe('footing')
    expect(guessIntensity('VMA 400m', 'Run', 120, zones)).toBe('vma')
  })
  it('falls back to autre when avgHr null and no zones', () => {
    expect(guessIntensity('Sortie', 'Run', null, [])).toBe('autre')
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
  it('default → autre', () => {
    expect(guessWorkoutType('Sortie du matin', 'Run')).toBe('autre')
    expect(guessWorkoutType('Footing matinal', 'Run')).toBe('autre')
  })
})

describe('INTENSITY_OPTIONS', () => {
  it('has 11 entries (IntensityKey for UI — includes recuperation + endurance_active)', () => {
    expect(INTENSITY_OPTIONS).toHaveLength(11)
  })
})

describe('SPORT_OPTIONS', () => {
  it('has 10 entries', () => {
    expect(SPORT_OPTIONS).toHaveLength(10)
  })
})
