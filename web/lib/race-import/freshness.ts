// Fraîcheur d'un tableau importé : compare l'édition détectée à l'année de la fiche.
// Fonction PURE et client-safe (réutilisée dans la table de validation) — pas de server-only.
import type { FreshnessStatus } from '@/types/plan'

export interface DetectedEdition {
  editionYear: number | null
  editionDate: string | null        // ISO YYYY-MM-DD si connu (signal fort)
  dateExplicit: boolean
  startDayOfMonth: number | null    // signal indépendant (LiveTrail)
}

export interface FreshnessResult {
  editionYear: number | null
  editionDate: string | null
  freshnessStatus: FreshnessStatus
}

function partsOf(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null
}

export function computeFreshness(detected: DetectedEdition, ficheDateISO: string): FreshnessResult {
  const fiche = partsOf(ficheDateISO)
  const detYear = detected.editionDate ? partsOf(detected.editionDate)?.y ?? null : detected.editionYear

  // Année cible ou année détectée inexploitable → unknown.
  if (fiche == null || detYear == null) {
    return { editionYear: detYear, editionDate: detected.editionDate, freshnessStatus: 'unknown' }
  }

  if (detYear < fiche.y) {
    return { editionYear: detYear, editionDate: detected.editionDate, freshnessStatus: 'provisional_previous_edition' }
  }
  if (detYear > fiche.y) {
    return { editionYear: detYear, editionDate: detected.editionDate, freshnessStatus: 'unknown' }
  }

  // detYear === année cible.
  // Date explicite (UTMB / LLM) = signal fort → confirmed, recoupement jour ignoré.
  if (detected.editionDate) {
    return { editionYear: detYear, editionDate: detected.editionDate, freshnessStatus: 'confirmed' }
  }
  // Jour XML connu mais différent de la fiche → incohérent → unknown.
  if (detected.startDayOfMonth != null && detected.startDayOfMonth !== fiche.d) {
    return { editionYear: detYear, editionDate: null, freshnessStatus: 'unknown' }
  }
  // Jour concorde ou inconnu → confirmed. Reconstruit editionDate si le jour concorde.
  const editionDate =
    detected.startDayOfMonth != null && detected.startDayOfMonth === fiche.d
      ? `${fiche.y}-${String(fiche.m).padStart(2, '0')}-${String(fiche.d).padStart(2, '0')}`
      : null
  return { editionYear: detYear, editionDate, freshnessStatus: 'confirmed' }
}
