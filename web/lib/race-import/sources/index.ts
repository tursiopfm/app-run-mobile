// Point d'extension futur pour parsers site-spécifiques.
// Phase 1 : aucun parser concret enregistré, défaut LLM partout.
import type { ExtractedRaceData } from '@/types/plan'

export interface RaceParser {
  id: string
  match(url: string): boolean
  parse(html: string): Promise<ExtractedRaceData>
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
