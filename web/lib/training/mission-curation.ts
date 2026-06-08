import type { SessionTemplate } from '@/types/plan'

const MISSION_RELEVANT_TYPES: Record<string, ReadonlyArray<string>> = {
  route: ['footing', 'seuil_tempo', 'fractionne', 'sortie_longue', 'course'],
  trail: ['footing', 'sortie_longue', 'seuil_tempo', 'cotes', 'course'],
}
const MISSION_KEY_SESSION: Record<string, string> = {
  trail: 'co-4x4min',
  route: 'se-2x20',
}

/**
 * Réordonne (sans filtrer ni dédupliquer) les templates pour mettre en avant ce
 * qui sert l'objectif : séance clé en tête, puis types pertinents, puis le reste.
 * Pour charge/libre/inconnu/null : liste inchangée (même référence). Tri stable.
 */
export function curateTemplatesForMission(
  templates: SessionTemplate[],
  mission: string | null | undefined,
): SessionTemplate[] {
  const relevant = mission ? MISSION_RELEVANT_TYPES[mission] : undefined
  if (!mission || !relevant) return templates
  const keyId = MISSION_KEY_SESSION[mission]
  const rank = (t: SessionTemplate): number => (t.id === keyId ? 0 : relevant.includes(t.type) ? 1 : 2)
  return templates
    .map((t, i) => ({ t, i, r: rank(t) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.t)
}
