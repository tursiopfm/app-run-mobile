// Moteur pur de génération des semaines d'un mésocycle selon son load_pattern.
// Aucune dépendance Supabase/React. Testable en isolation.
//
// Patterns implémentés en V1 :
//   - progressive_3_1 : cycle 4 sem [80%, 90%, 100% load, 65% deload].
//   - progressive_2_1 : cycle 3 sem [85%, 100% load, 65% deload].
//   - taper           : décroissance linéaire de 0.85 à 0.40, type 'taper'.
//   - maintenance     : 100% du baseline, type 'load'.
//   - recovery        : 50% du baseline, type 'recovery'.
//   - competition     : 1 semaine, volumes à 0, type 'race'.
//   - custom          : aucune génération (retourne []).

import type { LoadPattern, WeekType } from '@/types/plan'

export interface PatternInput {
  startDate: string           // ISO YYYY-MM-DD de la 1ʳᵉ semaine
  weekCount: number           // nombre de semaines à générer
  baselineLoadTss: number     // charge "max" du bloc (TSS/sem)
  baselineVolumeKm: number    // km "max" du bloc
  baselineDplusM: number      // D+ "max" du bloc (m)
}

export interface GeneratedWeek {
  weekIndex: number
  weekStartDate: string
  weekType: WeekType
  targetLoadTss: number       // entier
  targetVolumeKm: number      // arrondi 0.1
  targetDplusM: number        // entier
  generatedFromPattern: true
  isManualOverride: false
}

// Ratios appliqués au baseline pour chaque semaine d'un cycle.
const CYCLE_3_1: ReadonlyArray<{ ratio: number; type: WeekType }> = [
  { ratio: 0.80, type: 'load' },
  { ratio: 0.90, type: 'load' },
  { ratio: 1.00, type: 'load' },
  { ratio: 0.65, type: 'deload' },
]

const CYCLE_2_1: ReadonlyArray<{ ratio: number; type: WeekType }> = [
  { ratio: 0.85, type: 'load' },
  { ratio: 1.00, type: 'load' },
  { ratio: 0.65, type: 'deload' },
]

const MS_PER_DAY = 86_400_000

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDaysISO(iso: string, days: number): string {
  return toISODate(new Date(parseISODate(iso).getTime() + days * MS_PER_DAY))
}

function roundKm(v: number): number {
  return Math.round(v * 10) / 10
}

function makeWeek(
  input: PatternInput,
  index: number,
  ratio: number,
  weekType: WeekType,
): GeneratedWeek {
  return {
    weekIndex: index,
    weekStartDate: addDaysISO(input.startDate, index * 7),
    weekType,
    targetLoadTss: Math.round(input.baselineLoadTss * ratio),
    targetVolumeKm: roundKm(input.baselineVolumeKm * ratio),
    targetDplusM: Math.round(input.baselineDplusM * ratio),
    generatedFromPattern: true,
    isManualOverride: false,
  }
}

export function generateWeeks(pattern: LoadPattern, input: PatternInput): GeneratedWeek[] {
  if (input.weekCount <= 0) return []
  if (pattern === 'custom') return []

  if (pattern === 'progressive_3_1') {
    const out: GeneratedWeek[] = []
    for (let i = 0; i < input.weekCount; i++) {
      const step = CYCLE_3_1[i % CYCLE_3_1.length]
      out.push(makeWeek(input, i, step.ratio, step.type))
    }
    return out
  }

  if (pattern === 'progressive_2_1') {
    const out: GeneratedWeek[] = []
    for (let i = 0; i < input.weekCount; i++) {
      const step = CYCLE_2_1[i % CYCLE_2_1.length]
      out.push(makeWeek(input, i, step.ratio, step.type))
    }
    return out
  }

  if (pattern === 'taper') {
    const out: GeneratedWeek[] = []
    const startRatio = 0.85
    const endRatio = 0.40
    for (let i = 0; i < input.weekCount; i++) {
      const ratio = input.weekCount === 1
        ? startRatio
        : startRatio - (startRatio - endRatio) * (i / (input.weekCount - 1))
      out.push(makeWeek(input, i, ratio, 'taper'))
    }
    return out
  }

  // Autres patterns : ajoutés progressivement dans les sous-tasks suivantes.
  throw new Error(`Pattern not implemented yet: ${pattern}`)
}
