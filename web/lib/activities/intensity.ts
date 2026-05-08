import type { HrZone } from '@/lib/health/hr-zones'
import { hrZoneForAvgHr } from '@/lib/health/hr-zones'

/**
 * UI dropdown selection + computed values.
 * Étendu : + 'recuperation' + 'endurance_active' par rapport à la version originale.
 */
export type IntensityKey =
  | 'recuperation' | 'footing' | 'endurance_active'
  | 'sortie_longue' | 'cotes' | 'vma'
  | 'seuil' | 'runtaf' | 'velotaf' | 'course' | 'autre'

/** Type de séance déduit du nom — orthogonal à l'intensité cardiaque */
export type WorkoutType =
  | 'sortie_longue'
  | 'fractionne'
  | 'cotes'
  | 'course'
  | 'runtaf'
  | 'velotaf'
  | 'autre'

export type IntensityOption = { key: IntensityKey; label: string }
export type SportOption     = { value: string; label: string }

export const INTENSITY_OPTIONS: IntensityOption[] = [
  { key: 'recuperation',     label: '😴 Récupération'    },
  { key: 'footing',          label: '🦶 Footing / EF'    },
  { key: 'endurance_active', label: '🔄 Endurance active' },
  { key: 'sortie_longue',    label: '🐢 Sortie longue'   },
  { key: 'cotes',            label: '⛰️ Côtes'            },
  { key: 'vma',              label: '🔥 VMA'              },
  { key: 'seuil',            label: '🎯 Seuil'            },
  { key: 'runtaf',           label: '🏃‍♂️🏢 Runtaf'    },
  { key: 'velotaf',          label: '🚴🏻🏢 Vélotaf'   },
  { key: 'course',           label: '🏁 Course'           },
  { key: 'autre',            label: '❓ Autre'             },
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

/**
 * Retourne l'intensité cardiaque estimée d'une activité.
 * Priorité : keywords intensité → zone FC → autre.
 * Ne jamais utiliser le CES comme proxy d'intensité.
 * Signature v2 : le paramètre "ces" (ancienne 2e position) est supprimé.
 */
export function guessIntensity(
  name:     string,
  sport:    string,
  avgHr?:   number | null,
  hrZones?: HrZone[],
): IntensityKey {
  const n = name.toLowerCase()

  // 1. VMA / fractionné (intensité la plus haute → prioritaire)
  if (/(?<!\d)(200|300|400|500|800|1000)(?!\d)/.test(n)
      || n.includes('vma') || n.includes('interval') || n.includes('fractionné')
      || n.includes('fractionnée') || n.includes('répétition') || n.includes('repetition'))
    return 'vma'

  // 2. Seuil / tempo
  if (n.includes('seuil') || n.includes('tempo') || n.includes('threshold'))
    return 'seuil'

  // 3. Récupération
  if (n.includes('récup') || n.includes('recovery'))
    return 'recuperation'

  // 4. Footing / endurance facile
  if (n.includes('footing') || /\bef\b/.test(n) || n.includes('endurance facile'))
    return 'footing'

  // 5. Zone FC depuis avg_hr
  if (avgHr != null && hrZones && hrZones.length > 0) {
    const zone = hrZoneForAvgHr(avgHr, hrZones)
    if (zone !== null) return zoneToIntensity(zone)
  }

  return 'autre'
}

/**
 * Retourne le type de séance déduit du nom de l'activité.
 * Orthogonal à l'intensité : une sortie longue peut être footing OU endurance_active.
 */
export function guessWorkoutType(name: string, sport: string): WorkoutType {
  const n = name.toLowerCase()

  // 1. Côtes / montées (priorité sur fractionné — "Côtes 200m" = côtes, le 200 est la distance par rep)
  if (n.includes('côtes') || n.includes('cotes') || n.includes('côte') || n.includes('cote')
      || n.includes('montée') || n.includes('montee') || n.includes('hill'))
    return 'cotes'

  // 2. Fractionné / intervalles
  if (/(?<!\d)(200|300|400|500|800|1000)(?!\d)/.test(n)
      || n.includes('vma') || n.includes('interval') || n.includes('fractionné')
      || n.includes('fractionnée') || n.includes('répétition') || n.includes('repetition'))
    return 'fractionne'

  // 3. Compétition — exclure "course à pied" (= running en français, pas une race)
  const isCourseAPied = n.includes('course à pied') || n.includes('course a pied')
  if (!isCourseAPied) {
    if (n.includes('race') || n.includes('compét') || n.includes('compet')
        || n.includes('dossard') || n.includes('chrono') || n.includes(' pb ')
        || n.includes(' pr ') || /\b10k\b/.test(n) || n.includes('semi')
        || n.includes('marathon'))
      return 'course'
  }

  // 4. Sortie longue
  if (n.includes('sortie longue') || /\bsl\b/.test(n) || n.includes('long run') || n.includes('lsl'))
    return 'sortie_longue'

  // 5. Runtaf
  if (n.includes('runtaf') || n.includes('run taf')
      || (n.includes('taf') && sport === 'Run'))
    return 'runtaf'

  // 6. Vélotaf
  if (n.includes('vélotaf') || n.includes('velotaf') || n.includes('vélo taf')
      || name.includes('Home 🚴🏻') || name.includes('🚴🏻 Home')
      || (n.includes('taf') && (sport === 'Ride' || sport === 'EBikeRide')))
    return 'velotaf'

  return 'autre'
}
