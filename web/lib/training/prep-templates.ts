// Templates de prépa : 4 presets pour générer un macrocycle pré-structuré
// (ultra / trail court / reprise / personnalisé). Module pur sans dépendance
// React/Supabase. Consommé par NewMacrocycleModal.

import type { LoadPattern, Phase, PhaseType } from '@/types/plan'
import {
  DEFAULT_WEEKLY_CHARGE,
  DEFAULT_WEEKLY_DISTANCE_KM,
  DEFAULT_WEEKLY_ELEVATION_M,
  PHASE_DEFINITIONS,
} from './phases'

export type PrepTemplateId = 'ultra' | 'trail_court' | 'reprise' | 'custom'

export interface TemplatePhaseRecipe {
  type: PhaseType
  label: string
  focus?: string
  loadPattern: LoadPattern
  weeks: number          // durée nominale en semaines (avant compression)
}

export interface PrepTemplate {
  id: PrepTemplateId
  label: string          // 'Ultra', 'Trail court', 'Reprise', 'Personnalisé'
  description: string    // 1 ligne UI ('Foncier 6s · Force/D+ 5s · …')
  nominalWeeks: number   // somme des weeks
  minWeeks: number       // en dessous → compression forte mais on génère quand même
  recipes: TemplatePhaseRecipe[]
}

export interface ApplyTemplateResult {
  phases: Phase[]
  meta: {
    nominalWeeks: number
    availableWeeks: number
    compressed: boolean
    error?: 'too_short'
  }
}

// ─── Les 4 templates ──────────────────────────────────────────────────────────
export const PREP_TEMPLATES: Record<PrepTemplateId, PrepTemplate> = {
  ultra: {
    id: 'ultra',
    label: 'Ultra',
    description: 'Foncier 6s · Force/D+ 5s · Spécifique 6s · Sim 2s · Taper 2s',
    nominalWeeks: 21,
    minWeeks: 12,
    recipes: [
      { type: 'foncier',       label: 'Foncier base aérobie', focus: 'Base aérobie',         loadPattern: 'progressive_3_1', weeks: 6 },
      { type: 'developpement', label: 'Force / D+',           focus: 'Force / Côtes / D+',   loadPattern: 'progressive_3_1', weeks: 5 },
      { type: 'specifique',    label: 'Spécifique ultra',     focus: 'Spécifique terrain',   loadPattern: 'progressive_2_1', weeks: 6 },
      { type: 'specifique',    label: 'Simulation course',    focus: 'Sorties longues sim.', loadPattern: 'maintenance',     weeks: 2 },
      { type: 'affutage',      label: 'Affûtage',             focus: 'Taper',                loadPattern: 'taper',           weeks: 2 },
    ],
  },
  trail_court: {
    id: 'trail_court',
    label: 'Trail court',
    description: 'Foncier 4s · VMA 4s · Seuil 3s · Spé 3s · Taper 1s',
    nominalWeeks: 15,
    minWeeks: 8,
    recipes: [
      { type: 'foncier',       label: 'Foncier base aérobie', focus: 'Base aérobie',     loadPattern: 'progressive_3_1', weeks: 4 },
      { type: 'developpement', label: 'VMA',                  focus: 'VMA / VO2max',     loadPattern: 'progressive_3_1', weeks: 4 },
      { type: 'developpement', label: 'Seuil',                focus: 'Seuil / tempo',    loadPattern: 'progressive_2_1', weeks: 3 },
      { type: 'specifique',    label: 'Spécifique trail',     focus: 'Côtes / terrain',  loadPattern: 'progressive_2_1', weeks: 3 },
      { type: 'affutage',      label: 'Affûtage',             focus: 'Taper',            loadPattern: 'taper',           weeks: 1 },
    ],
  },
  reprise: {
    id: 'reprise',
    label: 'Reprise',
    description: 'Récup 2s · Foncier 6s · Développement 4s',
    nominalWeeks: 12,
    minWeeks: 6,
    recipes: [
      { type: 'recuperation',  label: 'Reprise progressive', focus: 'Régénération',      loadPattern: 'recovery',        weeks: 2 },
      { type: 'foncier',       label: 'Foncier',             focus: 'Reconstruction',    loadPattern: 'progressive_3_1', weeks: 6 },
      { type: 'developpement', label: 'Développement',       focus: 'Premières allures', loadPattern: 'progressive_2_1', weeks: 4 },
    ],
  },
  custom: {
    id: 'custom',
    label: 'Personnalisé',
    description: 'Macro vide à remplir manuellement',
    nominalWeeks: 0,
    minWeeks: 0,
    recipes: [],
  },
}

// ─── Helpers de date (UTC, sans dépendance externe) ───────────────────────────
const MS_PER_DAY = 86_400_000

function parseISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1)
}

function toISO(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `phase-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// ─── applyTemplate ───────────────────────────────────────────────────────────
export function applyTemplate(
  templateId: PrepTemplateId,
  macroStartISO: string,
  macroEndISO: string,
): ApplyTemplateResult {
  const tpl = PREP_TEMPLATES[templateId]
  const startMs = parseISO(macroStartISO)
  const endMs = parseISO(macroEndISO)
  const availableDays = Math.max(0, Math.floor((endMs - startMs) / MS_PER_DAY))
  const availableWeeks = Math.max(0, Math.ceil(availableDays / 7))

  // Cas custom : pas de phases, pas d'erreur.
  if (tpl.recipes.length === 0) {
    return {
      phases: [],
      meta: { nominalWeeks: tpl.nominalWeeks, availableWeeks, compressed: false },
    }
  }

  // Cas trop court (< 1 semaine ET pas même 1 jour) : erreur.
  if (availableWeeks < 1 || availableDays < 1) {
    return {
      phases: [],
      meta: { nominalWeeks: tpl.nominalWeeks, availableWeeks, compressed: false, error: 'too_short' },
    }
  }

  // Compression proportionnelle si nécessaire.
  const compressed = availableWeeks < tpl.nominalWeeks
  const ratio = availableWeeks / tpl.nominalWeeks
  // Calculer weeks compressées, jamais < 1.
  const compressedWeeks = tpl.recipes.map(r => Math.max(1, Math.round(r.weeks * ratio)))

  // Allouer dates phase par phase. La dernière phase est ajustée pour matcher
  // exactement macroEndISO (gestion des arrondis cumulés).
  const phases: Phase[] = []
  let cursorMs = startMs
  for (let i = 0; i < tpl.recipes.length; i++) {
    const recipe = tpl.recipes[i]
    const isLast = i === tpl.recipes.length - 1
    const weeks = compressedWeeks[i]
    const phaseEndMs = isLast ? endMs : cursorMs + weeks * 7 * MS_PER_DAY
    // Garde-fou : si phaseEndMs <= cursorMs (cumul d'arrondis trop fort), garde 1 jour.
    const safeEndMs = phaseEndMs > cursorMs ? phaseEndMs : cursorMs + MS_PER_DAY
    phases.push({
      id: makeId(),
      type: recipe.type,
      label: recipe.label,
      startDate: toISO(cursorMs),
      endDate: toISO(safeEndMs),
      weeklyChargeTarget: DEFAULT_WEEKLY_CHARGE[recipe.type],
      weeklyDistanceKmTarget: DEFAULT_WEEKLY_DISTANCE_KM[recipe.type],
      weeklyElevationMTarget: DEFAULT_WEEKLY_ELEVATION_M[recipe.type],
      focus: recipe.focus,
      loadPattern: recipe.loadPattern,
      description: PHASE_DEFINITIONS[recipe.type].description,
    })
    cursorMs = safeEndMs
  }

  return {
    phases,
    meta: { nominalWeeks: tpl.nominalWeeks, availableWeeks, compressed },
  }
}
