// Hash du CONTENU MÉTIER d'un tableau (pas du HTML brut) : stable aux changements
// cosmétiques de la source, bouge si parcours / barrière / ravito changent.
// Socle du diff de fraîcheur (Lot 2).
import 'server-only'
import { createHash } from 'node:crypto'
import type { RaceWaypoint } from '@/types/plan'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>

export function hashWaypoints(waypoints: WP[]): string {
  const canonical = waypoints
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((w) => ({
      orderIndex: w.orderIndex,
      name: w.name,
      km: w.km,
      dPlus: w.dPlus,
      dMoins: w.dMoins,
      cutoffRaw: w.cutoffRaw,
      type: w.type,
      supplies: [...w.supplies].sort(),
    }))
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
