import type { HrZone } from '@/lib/health/hr-zones'
import { hrZoneForAvgHr, distributeTimeInZones } from '@/lib/health/hr-zones'

export type IntensityKey =
  | 'recuperation' | 'footing' | 'endurance_active' | 'seuil' | 'vma'

export type WorkoutType =
  | 'sortie_longue' | 'fractionne' | 'seuil_tempo' | 'cotes' | 'course' | 'runtaf' | 'velotaf' | 'footing'
  | 'velo' | 'natation' | 'renfo' | 'musculation'

const INTENSITY_KEYS: ReadonlySet<string> = new Set([
  'recuperation', 'footing', 'endurance_active', 'seuil', 'vma',
])

const WORKOUT_TYPE_KEYS: ReadonlySet<string> = new Set([
  'sortie_longue', 'fractionne', 'seuil_tempo', 'cotes', 'course', 'runtaf', 'velotaf', 'footing',
  'velo', 'natation', 'renfo', 'musculation',
])

// Some legacy rows have invalid manual_intensity values (e.g. "runtaf" stored
// in the wrong column). Use this to coerce safely instead of casting blindly.
export function asIntensityKey(value: string | null | undefined): IntensityKey | null {
  return value && INTENSITY_KEYS.has(value) ? (value as IntensityKey) : null
}

// Coerce manual_workout_type to a WorkoutType, treating 'none' as the explicit
// "no type" override (disables auto-detection downstream).
export function asWorkoutType(value: string | null | undefined): WorkoutType | null {
  return value && WORKOUT_TYPE_KEYS.has(value) ? (value as WorkoutType) : null
}

// True when manual_workout_type explicitly opts out of auto-detection.
export function isExplicitNoType(value: string | null | undefined): boolean {
  return value === 'none'
}

// Effective workout type for display: explicit DB override → that type,
// 'none' sentinel → null, otherwise auto-detect from the title + sport.
export function effectiveWorkoutType(
  manual: string | null | undefined,
  name: string,
  sport: string,
): WorkoutType | null {
  if (isExplicitNoType(manual)) return null
  return asWorkoutType(manual) ?? guessWorkoutType(name, sport)
}

export type IntensityOption   = { key: IntensityKey; label: string }
export type SportOption       = { value: string; label: string }
export type WorkoutTypeOption = { value: WorkoutType; label: string; sports?: string[] }

export const INTENSITY_OPTIONS: IntensityOption[] = [
  { key: 'recuperation',     label: '😴 Récupération' },
  { key: 'footing',          label: '🦶 Endurance'    },
  { key: 'endurance_active', label: '🔄 Tempo'        },
  { key: 'seuil',            label: '🎯 Seuil'        },
  { key: 'vma',              label: '🔥 VMA'          },
]

export const WORKOUT_TYPE_OPTIONS: WorkoutTypeOption[] = [
  { value: 'sortie_longue', label: '🐢 Sortie longue' },
  { value: 'fractionne',    label: '⌚ Fractionné'    },
  { value: 'seuil_tempo',   label: '⏱️ Seuil / Tempo' },
  { value: 'cotes',         label: '⛰️ Côtes'          },
  { value: 'course',        label: '🏆 Course'         },
  { value: 'runtaf',        label: '🏃‍♂️💻 Runtaf',  sports: ['Run', 'TrailRun'] },
  { value: 'velotaf',       label: '🚴🏻💻 Velotaf', sports: ['Ride', 'EBikeRide', 'VirtualRide'] },
  { value: 'footing',       label: '👟 Endurance Fondamentale' },
  { value: 'velo',          label: '🚴 Vélo', sports: ['Ride', 'EBikeRide', 'VirtualRide'] },
  { value: 'natation',      label: '🏊 Natation', sports: ['Swim'] },
  { value: 'renfo',         label: '🤸 Renfo' },
  { value: 'musculation',   label: '💪 Musculation', sports: ['WeightTraining'] },
]

export const SPORT_OPTIONS: SportOption[] = [
  { value: 'Run',            label: 'Running'         },
  { value: 'TrailRun',       label: 'Trail'           },
  { value: 'Walk',           label: 'Marche'          },
  { value: 'Hike',           label: 'Randonnée'       },
  { value: 'Ride',           label: 'Vélo'            },
  { value: 'VirtualRide',    label: 'Vélo virtuel'    },
  { value: 'EBikeRide',      label: 'Vélo électrique' },
  { value: 'Swim',           label: 'Natation'        },
  { value: 'WeightTraining', label: 'Muscu'           },
  { value: 'Workout',        label: 'Autre'           },
]

export function secondsToHMS(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function hmsToSeconds(hms: string): number | null {
  const match = hms.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
}

function zoneToIntensity(zone: number): IntensityKey {
  if (zone <= 1) return 'recuperation'
  if (zone === 2) return 'footing'
  if (zone === 3) return 'endurance_active'
  if (zone === 4) return 'seuil'
  return 'vma'
}

const VMA_Z5_RATIO         = 0.10  // ≥ 10% en Z5 → effort VO₂max
const SEUIL_Z4_Z5_RATIO    = 0.15  // ≥ 15% en Z4+Z5 → séance qualité
const ENDURANCE_ACTIVE_Z3P = 0.20  // ≥ 20% en Z3+ → intensité modérée soutenue

export function classifyIntensityFromZoneTimes(zoneTimesSec: number[]): IntensityKey | null {
  if (zoneTimesSec.length !== 5) return null

  const clamped = zoneTimesSec.map(v => Math.max(0, v))
  const total   = clamped.reduce((s, v) => s + v, 0)
  if (total <= 0) return null

  const [z1, z2, z3, z4, z5] = clamped
  if ((z5)            / total >= VMA_Z5_RATIO)         return 'vma'
  if ((z4 + z5)       / total >= SEUIL_Z4_Z5_RATIO)    return 'seuil'
  if ((z3 + z4 + z5)  / total >= ENDURANCE_ACTIVE_Z3P) return 'endurance_active'
  if (z2 >= z1) return 'footing'
  return 'recuperation'
}

export type GuessIntensityOptions = {
  activityMaxHr?: number | null
  movingTimeSec?: number | null
  restingHr?:     number | null
}

export function guessIntensity(
  avgHr?:   number | null,
  hrZones?: HrZone[],
  opts?:    GuessIntensityOptions,
): IntensityKey | null {
  if (avgHr == null || !hrZones || hrZones.length === 0) return null

  const activityMaxHr = opts?.activityMaxHr
  const movingTimeSec = opts?.movingTimeSec
  if (activityMaxHr != null && activityMaxHr > avgHr
      && movingTimeSec != null && movingTimeSec > 0) {
    const restingHr = opts?.restingHr
      ?? Math.max(avgHr - 3 * Math.max((activityMaxHr - avgHr) / 2, 3), 40)
    const zoneTimes = distributeTimeInZones(hrZones, avgHr, activityMaxHr, movingTimeSec, restingHr)
    const fromDistribution = classifyIntensityFromZoneTimes(zoneTimes)
    if (fromDistribution !== null) return fromDistribution
  }

  const zone = hrZoneForAvgHr(avgHr, hrZones)
  if (zone === null) return null
  return zoneToIntensity(zone)
}

const INTENSITY_ORDER: IntensityKey[] = ['recuperation', 'footing', 'endurance_active', 'seuil', 'vma']

// Sur ces séances la FC moyenne sous-estime l'effort (récups entre les blocs).
// 'course' est volontairement absent : un ultra se court en endurance, son
// intensité mesurée est la bonne.
const WORKOUT_INTENSITY_FLOOR: Partial<Record<WorkoutType, IntensityKey>> = {
  fractionne:  'endurance_active',
  seuil_tempo: 'endurance_active',
  cotes:       'endurance_active',
}

export function intensityWithWorkoutFloor(
  intensity: IntensityKey | null,
  workoutType: WorkoutType | null,
): IntensityKey | null {
  if (!intensity || !workoutType) return intensity
  const floor = WORKOUT_INTENSITY_FLOOR[workoutType]
  if (!floor) return intensity
  return INTENSITY_ORDER.indexOf(intensity) < INTENSITY_ORDER.indexOf(floor) ? floor : intensity
}

const RUN_SPORTS  = new Set(['Run', 'TrailRun'])
const BIKE_SPORTS = new Set(['Ride', 'EBikeRide', 'VirtualRide'])

// Commute patterns. Match either:
//   - "Home"/🏠 AND "Office"/🏢 in the title (regardless of emoji spacing), or
//   - a place emoji (🚉 station, 👨‍💻 telework, 🏢 office) plus a directional
//     arrow (➡️, →, ⇨). Covers titles like "🚉 ➡️ 👨‍💻" or "👨‍💻 ➡️ 🚉".
function isCommutePattern(name: string, n: string): boolean {
  const hasHome    = /home/.test(n)   || name.includes('🏠')
  const hasOffice  = /office/.test(n) || name.includes('🏢')
  if (hasHome && hasOffice) return true

  const hasArrow   = name.includes('➡️') || name.includes('→') || name.includes('⇨')
  const placeCount =
    (name.includes('🚉') ? 1 : 0) +
    (name.includes('👨‍💻') ? 1 : 0) +
    (name.includes('🏢') ? 1 : 0) +
    (name.includes('🏠') ? 1 : 0)
  return hasArrow && placeCount >= 1
}

export function guessWorkoutType(name: string, sport: string): WorkoutType | null {
  // Natation : type "Non défini" par défaut, on n'analyse jamais le titre.
  if (sport === 'Swim') return null

  const n = name.toLowerCase()

  // 1. Runtaf (Run / TrailRun uniquement)
  if (RUN_SPORTS.has(sport)) {
    if (n.includes('runtaf') || n.includes('run taf')
        || name.includes('Home 🏃‍♂️') || name.includes('🏃‍♂️ Home')
        || n.includes('taf')
        || isCommutePattern(name, n))
      return 'runtaf'
  }

  // 2. Velotaf (vélo uniquement)
  if (BIKE_SPORTS.has(sport)) {
    if (n.includes('vélotaf') || n.includes('velotaf') || n.includes('vélo taf')
        || name.includes('Home 🚴🏻') || name.includes('🚴🏻 Home')
        || n.includes('taf')
        || isCommutePattern(name, n))
      return 'velotaf'
  }

  // 3. Mots-clés fractionné explicites (prioritaire sur "côtes" — "fractionné en côte" = fractionné)
  if (n.includes('vma') || n.includes('interval') || n.includes('fractionné')
      || n.includes('fractionnée') || n.includes('répétition') || n.includes('repetition'))
    return 'fractionne'

  // 4. Côtes / montées (priorité sur seuil)
  if (n.includes('côtes') || n.includes('cotes') || n.includes('côte') || n.includes('cote')
      || n.includes('montée') || n.includes('montee') || n.includes('hill'))
    return 'cotes'

  // 5. Mots-clés seuil/tempo explicites
  if (n.includes('seuil') || n.includes('tempo') || n.includes('threshold'))
    return 'seuil_tempo'

  // 6. Distances courtes isolées (200-800 m) → fractionné
  if (/(?<!\d)(200|300|400|500|800)(?!\d)/.test(n))
    return 'fractionne'

  // 7. Distances longues isolées (1000-5000 m) → seuil/tempo
  if (/(?<!\d)(1000|2000|3000|5000)(?!\d)/.test(n))
    return 'seuil_tempo'

  // 8. Compétition — exclure "course à pied"
  const isCourseAPied = n.includes('course à pied') || n.includes('course a pied')
  if (!isCourseAPied) {
    if (n.includes('race') || n.includes('compét') || n.includes('compet')
        || n.includes('dossard') || n.includes('chrono') || n.includes(' pb ')
        || n.includes(' pr ') || /\b10k\b/.test(n) || n.includes('semi')
        || n.includes('marathon'))
      return 'course'
  }

  // 9. Sortie longue
  if (n.includes('sortie longue') || /\bsl\b/.test(n) || n.includes('long run') || n.includes('lsl'))
    return 'sortie_longue'

  return null
}
