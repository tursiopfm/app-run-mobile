export type IntensityKey =
  | 'footing' | 'sortie_longue' | 'cotes' | 'vma'
  | 'seuil'   | 'runtaf'       | 'velotaf' | 'course' | 'autre'

export type IntensityOption = { key: IntensityKey; label: string }
export type SportOption     = { value: string; label: string }

export const INTENSITY_OPTIONS: IntensityOption[] = [
  { key: 'footing',       label: '🦶 Footing / EF'  },
  { key: 'sortie_longue', label: '🐢 Sortie longue'  },
  { key: 'cotes',         label: '⛰️ Côtes'           },
  { key: 'vma',           label: '🔥 VMA'             },
  { key: 'seuil',         label: '🎯 Seuil'           },
  { key: 'runtaf',        label: '🏢🏃 Runtaf'        },
  { key: 'velotaf',       label: '🏢🚴 Vélotaf'       },
  { key: 'course',        label: '🏁 Course'          },
  { key: 'autre',         label: '❓ Autre'            },
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

export function guessIntensity(name: string, ces: number | null, sport: string): IntensityKey {
  const n = name.toLowerCase()

  if (n.includes('footing') || n.includes(' ef ') || n.includes('endurance facile') || n.includes('récup'))
    return 'footing'
  if (n.includes('sortie longue') || n.includes('sl ') || n.includes('long run') || n.includes('lsl'))
    return 'sortie_longue'
  if (n.includes('côtes') || n.includes('cotes') || n.includes('cote') || n.includes('montée'))
    return 'cotes'
  if (n.includes('400') || n.includes('200') || n.includes('vma') || n.includes('interval')
      || n.includes('fractionné') || n.includes('répétition'))
    return 'vma'
  if (n.includes('seuil') || n.includes('tempo') || n.includes('threshold'))
    return 'seuil'
  if (n.includes('runtaf') || n.includes('run taf') || (n.includes('taf') && sport === 'Run'))
    return 'runtaf'
  if (n.includes('vélotaf') || n.includes('velotaf') || n.includes('vélo taf')
      || (n.includes('taf') && (sport === 'Ride' || sport === 'EBikeRide')))
    return 'velotaf'
  if (n.includes('course') || n.includes('compet') || n.includes('race')
      || n.includes('10k') || n.includes('semi') || n.includes('marathon'))
    return 'course'

  // CES fallback
  if (ces !== null && ces > 120) return 'seuil'
  if (ces !== null && ces >= 70) return 'runtaf'
  if (ces !== null)              return 'footing'

  return 'autre'
}
