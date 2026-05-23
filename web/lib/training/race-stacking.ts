// Calcul pur du positionnement et du stacking des courses sur la timeline.
// Aucune dépendance React/Supabase, entièrement testable en isolation.

import type { Race } from '@/types/plan'

export type RaceMarker = {
  race: Race
  leftPercent: number   // position horizontale (0..100)
  lane: number          // 0 = priorité A, 1 = B/C, 2+ = lanes fantômes en cas de collision
}

const COLLISION_THRESHOLD_PERCENT = 8   // 2 markers à < 8% d'écart sur la même lane → collision
const MAX_LANE = 3                       // au-delà, log warn et on accepte la superposition visuelle
const DEFAULT_LANE = 0                   // toutes les courses démarrent en lane 0 (collées à la barre) ; on n'escalade qu'en cas de collision

function parseISODate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1)
}

export function computeRaceMarkers(
  races: Race[],
  macroStart: string,
  macroEnd: string,
): RaceMarker[] {
  const startMs = parseISODate(macroStart)
  const endMs = parseISODate(macroEnd)
  const totalMs = endMs - startMs
  if (totalMs <= 0) return []

  // 1. Filtrer + calculer leftPercent. Toutes les courses démarrent en lane 0.
  const inWindow: RaceMarker[] = races
    .filter(r => r.date >= macroStart && r.date <= macroEnd)
    .map(race => {
      const raceMs = parseISODate(race.date)
      const leftPercent = ((raceMs - startMs) / totalMs) * 100
      return { race, leftPercent, lane: DEFAULT_LANE }
    })
    .sort((a, b) => a.leftPercent - b.leftPercent)

  // 2. Détection collisions intra-lane : balayage gauche → droite. Sur collision,
  // on escalade d'UNE lane (lane+1). Cela garde toutes les bulles non-en-conflit
  // collées à la barre (lane 0) et n'étage que ce qui se chevauche réellement.
  const lastByLane = new Map<number, number>()

  for (const marker of inWindow) {
    let lane = marker.lane
    while (lane <= MAX_LANE) {
      const last = lastByLane.get(lane)
      if (last === undefined || marker.leftPercent - last >= COLLISION_THRESHOLD_PERCENT) {
        marker.lane = lane
        lastByLane.set(lane, marker.leftPercent)
        break
      }
      lane = lane + 1
    }
    if (lane > MAX_LANE) {
      // eslint-disable-next-line no-console
      console.warn('[race-stacking] max lane reached, visual collision possible:', marker.race.name)
      marker.lane = MAX_LANE
      lastByLane.set(MAX_LANE, marker.leftPercent)
    }
  }

  return inWindow
}
