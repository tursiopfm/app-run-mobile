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

  // 1. Filtrer + calculer leftPercent + lane initiale.
  const inWindow: RaceMarker[] = races
    .filter(r => r.date >= macroStart && r.date <= macroEnd)
    .map(race => {
      const raceMs = parseISODate(race.date)
      const leftPercent = ((raceMs - startMs) / totalMs) * 100
      const lane = race.priority === 'A' ? 0 : 1
      return { race, leftPercent, lane }
    })
    .sort((a, b) => a.leftPercent - b.leftPercent)

  // 2. Détection collisions intra-lane : balayage gauche → droite, pousse en lane fantôme.
  // Lane 0 réservée aux A, lane 1 aux B/C. En collision, on saute directement en
  // lane fantôme (>= 2) pour éviter qu'un A colle visuellement à un B/C.
  const lastByLane = new Map<number, number>()

  for (const marker of inWindow) {
    const baseLane = marker.lane
    let lane = baseLane
    while (lane <= MAX_LANE) {
      const last = lastByLane.get(lane)
      if (last === undefined || marker.leftPercent - last >= COLLISION_THRESHOLD_PERCENT) {
        marker.lane = lane
        lastByLane.set(lane, marker.leftPercent)
        break
      }
      // Première escalade : saute directement en lane fantôme (>= 2), peu importe baseLane.
      lane = lane < 2 ? 2 : lane + 1
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
