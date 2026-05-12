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

describe('classifyIntensityFromZoneTimes — cascade 15% Z5 / 20% Z4+Z5 / 40% Z3+', () => {
  it('100% Z2 → footing', () => {
    expect(classifyIntensityFromZoneTimes([0, 3600, 0, 0, 0])).toBe('footing')
  })

  it('100% Z1 → recuperation', () => {
    expect(classifyIntensityFromZoneTimes([3600, 0, 0, 0, 0])).toBe('recuperation')
  })

  it('Z1+Z2 > Z3+ (39% en Z3+, Z4+Z5 < 20%) → footing', () => {
    expect(classifyIntensityFromZoneTimes([10, 51, 30, 9, 0])).toBe('footing')
  })

  it('Trail des lavoirs (Z3 dominant, Z4+Z5 = 9%) → endurance_active', () => {
    expect(classifyIntensityFromZoneTimes([34, 102, 97, 23, 0])).toBe('endurance_active')
  })

  it('seuil exact à 40% Z3+ → bascule endurance_active', () => {
    expect(classifyIntensityFromZoneTimes([30, 30, 40, 0, 0])).toBe('endurance_active')
  })

  it('Z4+Z5 = 67%, Z5 = 11% (< 15%) → seuil', () => {
    expect(classifyIntensityFromZoneTimes([5, 10, 15, 50, 10])).toBe('seuil')
  })

  it('Z5 = 50% (VMA pur) → vma', () => {
    expect(classifyIntensityFromZoneTimes([5, 10, 10, 15, 40])).toBe('vma')
  })

  it('Z5 exactement 15% → vma', () => {
    expect(classifyIntensityFromZoneTimes([10, 20, 25, 30, 15])).toBe('vma')
  })

  it('Z5 = 14.9% (juste sous 15%), Z4+Z5 = 50% → seuil', () => {
    expect(classifyIntensityFromZoneTimes([200, 200, 200, 250, 149])).toBe('seuil')
  })

  it('Z4+Z5 exactement 20% (sans Z5) → seuil', () => {
    expect(classifyIntensityFromZoneTimes([30, 30, 20, 20, 0])).toBe('seuil')
  })

  it('toutes zones à 0 → null', () => {
    expect(classifyIntensityFromZoneTimes([0, 0, 0, 0, 0])).toBeNull()
  })

  it('tableau de taille incorrecte → null', () => {
    expect(classifyIntensityFromZoneTimes([100, 200, 300])).toBeNull()
  })

  // ── Cas réels mesurés sur l'app Trail Cockpit ─────────────────────────────
  it('VMA 16×300m r1\' (Z5=7%, Z4+Z5=33%) → seuil (empreinte FC sub-VO₂max)', () => {
    // Distribution mesurée : Z1=5, Z2=14, Z3=27, Z4=18, Z5=5 (min)
    expect(classifyIntensityFromZoneTimes([5, 14, 27, 18, 5])).toBe('seuil')
  })

  it('VMA 8×400m @4\'15 R200m (Z5=3%, Z4+Z5=20%) → seuil', () => {
    // Distribution mesurée : Z1=12, Z2=19, Z3=25, Z4=12, Z5=2 (min)
    expect(classifyIntensityFromZoneTimes([12, 19, 25, 12, 2])).toBe('seuil')
  })

  it('VMA pyramide 4×400/300/200 (Z5=3%, Z4+Z5=20%) → seuil', () => {
    // Distribution mesurée : Z1=13, Z2=18, Z3=24, Z4=12, Z5=2 (min)
    expect(classifyIntensityFromZoneTimes([13, 18, 24, 12, 2])).toBe('seuil')
  })

  it('Seuil 3×2000m r2\' (Z5=0%, Z4+Z5=20%) → seuil', () => {
    // Distribution mesurée : Z1=3, Z2=17, Z3=32, Z4=13, Z5=0 (min)
    expect(classifyIntensityFromZoneTimes([3, 17, 32, 13, 0])).toBe('seuil')
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

  // ── seuil_tempo (nouveau type) ─────────────────────────────────────────────
  it('"Seuil 3x2000m r2\'" → seuil_tempo (mot-clé explicite)', () => {
    expect(guessWorkoutType('Seuil 3x2000m r2\'', 'Run')).toBe('seuil_tempo')
  })

  it('"Tempo run 40min" → seuil_tempo', () => {
    expect(guessWorkoutType('Tempo run 40min', 'Run')).toBe('seuil_tempo')
  })

  it('"Threshold 4x10min" → seuil_tempo', () => {
    expect(guessWorkoutType('Threshold 4x10min', 'Run')).toBe('seuil_tempo')
  })

  it('"5x1000m allure semi" → seuil_tempo (1000 m sans mot-clé explicite)', () => {
    expect(guessWorkoutType('5x1000m allure semi', 'Run')).toBe('seuil_tempo')
  })

  it('"3x5000m" → seuil_tempo (5000 m)', () => {
    expect(guessWorkoutType('3x5000m', 'Run')).toBe('seuil_tempo')
  })

  it('"Seuil 8x400m" → seuil_tempo (priorité mot-clé seuil sur 400 m)', () => {
    expect(guessWorkoutType('Seuil 8x400m', 'Run')).toBe('seuil_tempo')
  })

  it('"VMA 5x1000m" → fractionne (priorité VMA sur 1000 m)', () => {
    expect(guessWorkoutType('VMA 5x1000m', 'Run')).toBe('fractionne')
  })

  it('"Fractionné 6x1000" → fractionne (mot-clé explicite, pas 1000)', () => {
    // Test existant — vérifie que la priorité fractionne explicite > 1000
    expect(guessWorkoutType('Fractionné 6x1000', 'Run')).toBe('fractionne')
  })
})
