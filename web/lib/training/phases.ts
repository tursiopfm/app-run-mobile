// Définitions et auto-distribution des phases (mésocycles) d'un plan d'entraînement.
// Règles clés :
//   - Affûtage ≥ 2 semaines
//   - Spécifique ≥ 3 semaines
//   - Prépa < 8 semaines  → warning + distribution minimaliste (Développement + Spécifique + Affûtage)
//   - Prépa > 20 semaines → split Foncier en Foncier 1 + récup intermédiaire + Foncier 2

import type { Phase, PhaseType } from '@/types/plan'

export const PHASE_DEFINITIONS: Record<PhaseType, {
  label: string
  color: string
  description: string
  defaultRatio: number
}> = {
  foncier: {
    label: 'Foncier',
    color: '#3B82F6',
    description:
      "Construction de la base aérobie. Volume progressif, sorties longues, " +
      "renforcement musculaire, peu d'intensité.",
    defaultRatio: 0.40,
  },
  developpement: {
    label: 'Développement',
    color: '#10B981',
    description:
      "Intégration de l'intensité (seuil, VMA). Volume maintenu, premières " +
      "séances spécifiques.",
    defaultRatio: 0.30,
  },
  specifique: {
    label: 'Spécifique',
    color: '#F97316',
    description:
      "Séances calquées sur la course cible : terrain, allures, dénivelé, " +
      "gestion de l'effort.",
    defaultRatio: 0.20,
  },
  affutage: {
    label: 'Affûtage',
    color: '#A855F7',
    description:
      "Volume réduit, intensité maintenue. On arrive frais et affûté le jour J.",
    defaultRatio: 0.10,
  },
  recuperation: {
    label: 'Récupération',
    color: '#94A3B8',
    description:
      "Régénération post-objectif. Activité légère, repos qualitatif, reprise " +
      "progressive.",
    defaultRatio: 0,
  },
}

// Charges hebdo cibles (TSS / semaine) par phase. Valeurs indicatives ; éditables côté UI.
const DEFAULT_WEEKLY_CHARGE: Record<PhaseType, number> = {
  foncier:       300,
  developpement: 400,
  specifique:    450,
  affutage:      250,
  recuperation:  150,
}

// Volume hebdo cible (km) par phase. Valeurs indicatives ; éditables côté UI.
const DEFAULT_WEEKLY_DISTANCE_KM: Record<PhaseType, number> = {
  foncier:       50,
  developpement: 60,
  specifique:    70,
  affutage:      40,
  recuperation:  25,
}

// D+ hebdo cible (m) par phase. Valeurs indicatives ; éditables côté UI.
const DEFAULT_WEEKLY_ELEVATION_M: Record<PhaseType, number> = {
  foncier:       800,
  developpement: 1000,
  specifique:    1500,
  affutage:      600,
  recuperation:  300,
}

const MS_PER_DAY = 86_400_000
const MS_PER_WEEK = 7 * MS_PER_DAY

function parseISODate(s: string): Date {
  // YYYY-MM-DD → Date en UTC pour éviter les dérives de fuseau.
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addWeeks(d: Date, weeks: number): Date {
  return new Date(d.getTime() + weeks * MS_PER_WEEK)
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback (rare : env Node sans webcrypto) — pas un vrai UUID mais unique pour les tests.
  return `phase-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function buildPhase(
  type: PhaseType,
  startDate: Date,
  endDate: Date,
  labelOverride?: string,
): Phase {
  const def = PHASE_DEFINITIONS[type]
  return {
    id: makeId(),
    type,
    label: labelOverride ?? `Phase ${def.label}`,
    startDate: toISODate(startDate),
    endDate: toISODate(endDate),
    weeklyChargeTarget: DEFAULT_WEEKLY_CHARGE[type],
    weeklyDistanceKmTarget: DEFAULT_WEEKLY_DISTANCE_KM[type],
    weeklyElevationMTarget: DEFAULT_WEEKLY_ELEVATION_M[type],
    description: def.description,
  }
}

/**
 * Distribue automatiquement les phases d'un macrocycle entre `startDate` et `raceDate`.
 *
 * Garanties :
 *   - Affûtage finit pile à `raceDate`, dure au moins 2 semaines.
 *   - Spécifique dure au moins 3 semaines (si le budget restant le permet).
 *   - Prépa < 8 semaines → warning console, pas de Foncier (Développement + Spécifique + Affûtage).
 *   - Prépa > 20 semaines → Foncier 1 + récup intermédiaire (1 sem) + Foncier 2.
 *
 * Retourne un tableau de Phase ordonné chronologiquement. Tableau vide si dates invalides.
 */
export function autoDistributePhases(startDate: string, raceDate: string): Phase[] {
  const start = parseISODate(startDate)
  const race = parseISODate(raceDate)
  const totalMs = race.getTime() - start.getTime()
  if (Number.isNaN(totalMs) || totalMs <= 0) return []

  const totalWeeks = Math.max(1, Math.round(totalMs / MS_PER_WEEK))

  // ─── Prépa courte (< 8 sem) : pas de Foncier ──────────────────────────────
  if (totalWeeks < 8) {
    // Affûtage = 2, Spécifique = 3, reste → Développement (min 1).
    // Si totalWeeks < 6 : on compresse Spécifique en priorité.
    console.warn('Prépa courte — privilégier Développement + Spécifique.')

    const affutageW = Math.min(2, totalWeeks)
    const specifiqueW = Math.min(3, Math.max(0, totalWeeks - affutageW))
    const dvpW = Math.max(0, totalWeeks - affutageW - specifiqueW)

    const phases: Phase[] = []
    let cursor = new Date(start)

    if (dvpW > 0) {
      const end = addWeeks(cursor, dvpW)
      phases.push(buildPhase('developpement', cursor, end))
      cursor = end
    }
    if (specifiqueW > 0) {
      const end = addWeeks(cursor, specifiqueW)
      phases.push(buildPhase('specifique', cursor, end))
      cursor = end
    }
    if (affutageW > 0) {
      const end = addWeeks(cursor, affutageW)
      phases.push(buildPhase('affutage', cursor, end))
      cursor = end
    }
    return phases
  }

  // ─── Prépa nominale (8-20 sem) ou longue (>20 sem) ────────────────────────
  // Pose les invariants de fin : Affûtage et Spécifique.
  const affutageW = Math.max(2, Math.round(totalWeeks * PHASE_DEFINITIONS.affutage.defaultRatio))
  const specifiqueW = Math.max(3, Math.round(totalWeeks * PHASE_DEFINITIONS.specifique.defaultRatio))

  // Budget restant pour Foncier + Développement.
  const tailW = affutageW + specifiqueW
  const headW = Math.max(0, totalWeeks - tailW)

  // Si après réservation Affûtage/Spécifique il ne reste rien, on rogne Spécifique (garde ≥ 3 si possible).
  let foncierW: number
  let dvpW: number

  if (headW <= 0) {
    foncierW = 0
    dvpW = 0
  } else {
    // Ratio Foncier vs Développement : ~ 40/30 → 4/7 vs 3/7 du head.
    foncierW = Math.max(0, Math.round(headW * 4 / 7))
    dvpW = Math.max(0, headW - foncierW)
  }

  // ─── Prépa longue : split Foncier en Foncier 1 + récup (1 sem) + Foncier 2 ─
  const isLong = totalWeeks > 20 && foncierW >= 3

  const phases: Phase[] = []
  let cursor = new Date(start)

  if (isLong) {
    // Découpe : Foncier 1 = floor((foncierW - 1) / 2), Foncier 2 = restant, récup = 1.
    const recupW = 1
    const remaining = foncierW - recupW
    const foncier1W = Math.floor(remaining / 2)
    const foncier2W = remaining - foncier1W

    if (foncier1W > 0) {
      const end = addWeeks(cursor, foncier1W)
      phases.push(buildPhase('foncier', cursor, end, 'Phase Foncier 1'))
      cursor = end
    }
    {
      const end = addWeeks(cursor, recupW)
      phases.push(buildPhase('recuperation', cursor, end, 'Récup intermédiaire'))
      cursor = end
    }
    if (foncier2W > 0) {
      const end = addWeeks(cursor, foncier2W)
      phases.push(buildPhase('foncier', cursor, end, 'Phase Foncier 2'))
      cursor = end
    }
  } else if (foncierW > 0) {
    const end = addWeeks(cursor, foncierW)
    phases.push(buildPhase('foncier', cursor, end))
    cursor = end
  }

  if (dvpW > 0) {
    const end = addWeeks(cursor, dvpW)
    phases.push(buildPhase('developpement', cursor, end))
    cursor = end
  }
  if (specifiqueW > 0) {
    const end = addWeeks(cursor, specifiqueW)
    phases.push(buildPhase('specifique', cursor, end))
    cursor = end
  }
  if (affutageW > 0) {
    const end = addWeeks(cursor, affutageW)
    phases.push(buildPhase('affutage', cursor, end))
    cursor = end
  }

  return phases
}
