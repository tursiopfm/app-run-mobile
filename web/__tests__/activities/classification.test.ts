// web/__tests__/activities/classification.test.ts
import {
  guessIntensity,
  guessWorkoutType,
  classifyIntensityFromZoneTimes,
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

describe('classifyIntensityFromZoneTimes — règle de bascule 40% Z3+', () => {
  it('100% Z2 → footing', () => {
    expect(classifyIntensityFromZoneTimes([0, 3600, 0, 0, 0])).toBe('footing')
  })

  it('100% Z1 → recuperation', () => {
    expect(classifyIntensityFromZoneTimes([3600, 0, 0, 0, 0])).toBe('recuperation')
  })

  it('Z1+Z2 > Z3+ (39% en Z3+) → footing (pas de bascule)', () => {
    expect(classifyIntensityFromZoneTimes([10, 51, 30, 9, 0])).toBe('footing')
  })

  it('Z3+ ≥ 40% avec Z3 dominant → endurance_active', () => {
    // Z1=34, Z2=102, Z3=97, Z4=23, Z5=0 (activité "Trail des lavoirs", Z3+ = 47%)
    expect(classifyIntensityFromZoneTimes([34, 102, 97, 23, 0])).toBe('endurance_active')
  })

  it('Z3+ ≥ 40% avec Z4 dominant → seuil', () => {
    expect(classifyIntensityFromZoneTimes([5, 10, 15, 50, 10])).toBe('seuil')
  })

  it('Z3+ ≥ 40% avec Z5 dominant → vma', () => {
    expect(classifyIntensityFromZoneTimes([5, 10, 10, 15, 40])).toBe('vma')
  })

  it('toutes zones à 0 → null', () => {
    expect(classifyIntensityFromZoneTimes([0, 0, 0, 0, 0])).toBeNull()
  })

  it('tableau de taille incorrecte → null', () => {
    expect(classifyIntensityFromZoneTimes([100, 200, 300])).toBeNull()
  })

  it('seuil exact à 40% Z3+ → bascule', () => {
    expect(classifyIntensityFromZoneTimes([30, 30, 40, 0, 0])).toBe('endurance_active')
  })
})

describe('guessIntensity — règle de distribution (option 3)', () => {
  // Profil Karvonen typique : FCmax=195, FCrepos=57
  // Z1≤140, Z2≤154, Z3≤167, Z4≤181, Z5≤195
  const KARVONEN_ZONES: HrZone[] = [
    { zone: 1, name: 'Récupération',           min: null, max: 140, color: '#4caf50' },
    { zone: 2, name: 'Endurance fondamentale',  min: 141, max: 154, color: '#38bdf8' },
    { zone: 3, name: 'Endurance active',        min: 155, max: 167, color: '#f59e0b' },
    { zone: 4, name: 'Seuil',                   min: 168, max: 181, color: '#e8651a' },
    { zone: 5, name: 'Très intense',            min: 182, max: 195, color: '#ef4444' },
  ]

  it('FC moy 153 avec FC max 177 sur 4h17 (Trail des lavoirs) → endurance_active', () => {
    // FC moy seule donnerait Z2 → footing.
    // Avec la distribution : ~47% du temps en Z3+ → bascule en endurance_active.
    const result = guessIntensity(153, KARVONEN_ZONES, {
      activityMaxHr: 177,
      movingTimeSec: 4 * 3600 + 17 * 60,
      restingHr:     57,
    })
    expect(result).toBe('endurance_active')
  })

  it('FC moy 145 avec FC max 150 (footing stable) → footing (pas de bascule)', () => {
    const result = guessIntensity(145, KARVONEN_ZONES, {
      activityMaxHr: 150,
      movingTimeSec: 60 * 60,
      restingHr:     57,
    })
    expect(result).toBe('footing')
  })

  it('sans activityMaxHr → fallback FC moyenne (Z2 → footing)', () => {
    expect(guessIntensity(153, KARVONEN_ZONES)).toBe('footing')
  })

  it('sans movingTimeSec → fallback FC moyenne', () => {
    const result = guessIntensity(153, KARVONEN_ZONES, { activityMaxHr: 177 })
    expect(result).toBe('footing')
  })

  it('activityMaxHr ≤ avgHr → fallback FC moyenne', () => {
    const result = guessIntensity(153, KARVONEN_ZONES, {
      activityMaxHr: 153,
      movingTimeSec: 3600,
    })
    expect(result).toBe('footing')
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
