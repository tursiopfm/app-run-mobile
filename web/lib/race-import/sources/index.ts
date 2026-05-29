// Point d'extension futur pour parsers site-spécifiques.
// Les parsers concrets s'enregistrent via registerParser() au load (effet de bord d'import).
import type { ExtractedRaceData } from '@/types/plan'

export interface RaceParser {
  id: string
  match(url: string): boolean
  parse(url: string): Promise<ExtractedRaceData>
}

const REGISTRY: RaceParser[] = []

export function registerParser(parser: RaceParser): void {
  REGISTRY.push(parser)
}

export function findParserForUrl(url: string): RaceParser | null {
  return REGISTRY.find((p) => p.match(url)) ?? null
}

export function getRegisteredParsers(): RaceParser[] {
  return [...REGISTRY]
}
