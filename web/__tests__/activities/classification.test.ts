// web/__tests__/activities/classification.test.ts
import {
  guessIntensity,
  guessWorkoutType,
} from '@/lib/activities/intensity'
import type { HrZone } from '@/lib/health/hr-zones'

const MOCK_ZONES: HrZone[] = [
  { zone: 1, name: 'Récupération',           min: null, max: 130, color: '#4caf50' },
  { zone: 2, name: 'Endurance fondamentale',  min: 131, max: 148, color: '#38bdf8' },
  { zone: 3, name: 'Endurance active',        min: 149, max: 162, color: '#f59e0b' },
  { zone: 4, name: 'Seuil',                   min: 163, max: 173, color: '#e8651a' },
  { zone: 5, name: 'Très intense',            min: 174, max: 190, color: '#ef4444' },
]

describe('guessIntensity — pure HR', () => {
  it('zone 1 → recuperation', () => {
    expect(guessIntensity(120, MOCK_ZONES)).toBe('recuperation')
  })
  it('zone 2 → footing', () => {
    expect(guessIntensity(140, MOCK_ZONES)).toBe('footing')
  })
  it('zone 3 → endurance_active', () => {
    expect(guessIntensity(155, MOCK_ZONES)).toBe('endurance_active')
  })
  it('zone 4 → seuil', () => {
    expect(guessIntensity(168, MOCK_ZONES)).toBe('seuil')
  })
  it('zone 5 → vma', () => {
    expect(guessIntensity(180, MOCK_ZONES)).toBe('vma')
  })
  it('null avgHr → null', () => {
    expect(guessIntensity(null, MOCK_ZONES)).toBeNull()
  })
  it('hrZones vides → null', () => {
    expect(guessIntensity(140, [])).toBeNull()
  })
  it('aucun argument → null', () => {
    expect(guessIntensity()).toBeNull()
  })
})

describe('guessWorkoutType — détection par titre', () => {
  it('"Sortie longue dimanche" → sortie_longue', () => {
    expect(guessWorkoutType('Sortie longue dimanche', 'Run')).toBe('sortie_longue')
  })
  it('"SL trail cool" → sortie_longue', () => {
    expect(guessWorkoutType('SL trail cool', 'TrailRun')).toBe('sortie_longue')
  })
  it('"10x400 VMA" → fractionne', () => {
    expect(guessWorkoutType('10x400 VMA', 'Run')).toBe('fractionne')
  })
  it('"Fractionné 6x1000" → fractionne', () => {
    expect(guessWorkoutType('Fractionné 6x1000', 'Run')).toBe('fractionne')
  })
  it('"Séance côtes 10x400" → cotes (priorité sur fractionne)', () => {
    expect(guessWorkoutType('Séance côtes 10x400', 'Run')).toBe('cotes')
  })
  it('"Hill repeats" → cotes', () => {
    expect(guessWorkoutType('Hill repeats', 'TrailRun')).toBe('cotes')
  })
  it('"10x400 côte" → cotes (priorité sur fractionne)', () => {
    expect(guessWorkoutType('10x400 côte', 'Run')).toBe('cotes')
  })
  it('"Marathon Paris" → course', () => {
    expect(guessWorkoutType('Marathon Paris', 'Run')).toBe('course')
  })
  it('"Semi objectif chrono" → course', () => {
    expect(guessWorkoutType('Semi objectif chrono', 'Run')).toBe('course')
  })
  it('"Runtaf maison bureau" + Run → runtaf', () => {
    expect(guessWorkoutType('Runtaf maison bureau', 'Run')).toBe('runtaf')
  })
  it('"taf" + TrailRun → runtaf', () => {
    expect(guessWorkoutType('taf', 'TrailRun')).toBe('runtaf')
  })
  it('"Velotaf bureau" + Ride → velotaf', () => {
    expect(guessWorkoutType('Velotaf bureau', 'Ride')).toBe('velotaf')
  })
  it('"taf" + EBikeRide → velotaf', () => {
    expect(guessWorkoutType('taf', 'EBikeRide')).toBe('velotaf')
  })
  it('"taf" + WeightTraining → null', () => {
    expect(guessWorkoutType('taf', 'WeightTraining')).toBeNull()
  })
})
