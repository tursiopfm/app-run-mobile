// Bibliothèque de templates de séances système.
// Source unique : ce fichier exporte SESSION_TEMPLATES, utilisé par
// BibliothequeSeancesBlock comme catalogue par défaut.
//
// Convention `defaultZones` :
// - fractionne / seuil_tempo (intervalles) / cotes  → warmup + RepeatZone + cooldown
// - seuil_tempo (tempo continu)                     → warmup + main + cooldown
// - sortie_longue                                   → 1 ou 3 mains (avec bloc)
// - footing / runtaf / velotaf / velo / natation    → 1 main (ou Repeat pour nat fractionnée)
// - renfo / musculation                             → aucune zone
//
// Référence spec : docs/superpowers/specs/2026-05-27-bibliotheque-seances-refonte-design.md

import type {
  SessionTemplate,
  TrainingZone,
  RepeatZone,
  RepeatStep,
  IntensityLevel,
} from '@/types/plan'

// ── Helpers de construction des zones ─────────────────────────────────

function warmup(durationMin: number = 20): TrainingZone {
  return {
    id: 'wu',
    kind: 'warmup',
    mode: 'duration',
    durationMin,
    intensity: 2,
    intensityMode: 'level',
    label: 'Échauffement',
  }
}

function cooldown(durationMin: number = 10): TrainingZone {
  return {
    id: 'cd',
    kind: 'cooldown',
    mode: 'duration',
    durationMin,
    intensity: 2,
    intensityMode: 'level',
    label: 'Retour au calme',
  }
}

function main(durationMin: number, intensity: IntensityLevel, label?: string): TrainingZone {
  return {
    id: `main-${intensity}-${durationMin}`,
    kind: 'main',
    mode: 'duration',
    durationMin,
    intensity,
    intensityMode: 'level',
    label,
  }
}

function effortStep(opts: {
  id?: string
  durationMin?: number
  distanceM?: number
  intensity: IntensityLevel
  label?: string
}): RepeatStep {
  const mode = opts.distanceM != null ? 'distance' : 'duration'
  return {
    id: opts.id ?? 'ef',
    stepKind: 'effort',
    mode,
    durationMin: opts.durationMin,
    distanceM: opts.distanceM,
    intensityMode: 'level',
    intensity: opts.intensity,
    label: opts.label,
  }
}

function recoveryStep(opts: {
  id?: string
  durationMin?: number
  distanceM?: number
  intensity?: IntensityLevel
  label?: string
}): RepeatStep {
  const mode = opts.distanceM != null ? 'distance' : 'duration'
  return {
    id: opts.id ?? 'rc',
    stepKind: 'recovery',
    mode,
    durationMin: opts.durationMin,
    distanceM: opts.distanceM,
    intensityMode: 'level',
    intensity: opts.intensity ?? 1,
    label: opts.label,
  }
}

function repeat(opts: {
  repeats: number
  effort: RepeatStep
  recovery: RepeatStep
  skipLastRecovery?: boolean
  id?: string
}): RepeatZone {
  return {
    id: opts.id ?? 'rep',
    kind: 'repeat',
    repeats: opts.repeats,
    skipLastRecovery: opts.skipLastRecovery ?? true,
    steps: [opts.effort, opts.recovery],
  }
}

// ── Catalogue ─────────────────────────────────────────────────────────

export const SESSION_TEMPLATES: SessionTemplate[] = [
  // === Récupération & footing (6) ===
  {
    id: 'ft-recup-30',
    type: 'footing',
    title: 'Footing récup 30min',
    defaultDuration: 30,
    defaultDistance: 4,
    defaultIntensity: 1,
    description: 'Footing très lent Z1 pour récupération active.',
    tags: ['récup', 'court'],
    defaultZones: [main(30, 1)],
  },
  {
    id: 'ft-decrassage-20',
    type: 'footing',
    title: 'Décrassage 20min',
    defaultDuration: 20,
    defaultDistance: 3,
    defaultIntensity: 1,
    description: 'Footing très lent 20min pour décrasser les jambes au lendemain d\'une grosse séance.',
    tags: ['récup', 'court'],
    defaultZones: [main(20, 1)],
  },
  {
    id: 'ft-30',
    type: 'footing',
    title: 'Footing 30min',
    defaultDuration: 30,
    defaultDistance: 5,
    defaultIntensity: 2,
    description: 'Footing facile, Z2.',
    tags: ['endurance', 'court'],
    defaultZones: [main(30, 2)],
  },
  {
    id: 'ft-45',
    type: 'footing',
    title: 'Footing 45min',
    defaultDuration: 45,
    defaultDistance: 7.5,
    defaultIntensity: 2,
    description: 'Footing endurance Z2.',
    tags: ['endurance'],
    defaultZones: [main(45, 2)],
  },
  {
    id: 'ft-1h',
    type: 'footing',
    title: 'Footing 1h',
    defaultDuration: 60,
    defaultDistance: 10,
    defaultIntensity: 2,
    description: 'Footing aérobie 1h, allure conversationnelle.',
    tags: ['endurance', 'aérobie'],
    defaultZones: [main(60, 2)],
  },
  {
    id: 'ft-progressif-1h',
    type: 'footing',
    title: 'Footing progressif 1h',
    defaultDuration: 60,
    defaultDistance: 10,
    defaultIntensity: 2,
    description: 'Footing 1h : 45min EF + 15min en accélération progressive (Z3).',
    tags: ['endurance', 'progressif'],
    defaultZones: [
      main(45, 2, '45min EF'),
      main(15, 3, '15min Z3'),
    ],
  },

  // === Sortie longue (5) ===
  {
    id: 'sl-1h30',
    type: 'sortie_longue',
    title: 'SL 1h30 vallonnée',
    defaultDuration: 90,
    defaultDistance: 15,
    defaultElevation: 400,
    defaultIntensity: 2,
    description: 'Endurance fondamentale sur terrain vallonné. Allure conversationnelle.',
    tags: ['endurance', 'base'],
    defaultZones: [main(90, 2)],
  },
  {
    id: 'sl-2h-progressive',
    type: 'sortie_longue',
    title: 'SL 2h progressive',
    defaultDuration: 120,
    defaultDistance: 20,
    defaultElevation: 500,
    defaultIntensity: 2,
    description: 'Sortie longue : 90min EF + 30min en allure soutenue (Z3).',
    tags: ['endurance', 'progressive'],
    defaultZones: [
      main(90, 2, '90min EF'),
      main(30, 3, '30min Z3'),
    ],
  },
  {
    id: 'sl-2h30',
    type: 'sortie_longue',
    title: 'SL 2h30 endurance',
    defaultDuration: 150,
    defaultDistance: 22,
    defaultElevation: 600,
    defaultIntensity: 2,
    description: 'Sortie longue 2h30 en endurance fondamentale. Volume pur.',
    tags: ['endurance', 'long', 'base'],
    defaultZones: [main(150, 2)],
  },
  {
    id: 'sl-3h-spe',
    type: 'sortie_longue',
    title: 'SL 3h spé trail',
    defaultDuration: 180,
    defaultDistance: 28,
    defaultElevation: 900,
    defaultIntensity: 3,
    description: 'SL trail : 60min EF + 60min relances en côtes (Z3) + 60min EF.',
    tags: ['spécifique', 'long', 'trail'],
    defaultZones: [
      main(60, 2, '60min EF'),
      main(60, 3, '60min relances Z3'),
      main(60, 2, '60min retour EF'),
    ],
  },
  {
    id: 'sl-bloc-marathon',
    type: 'sortie_longue',
    title: 'SL 1h45 bloc allure marathon',
    defaultDuration: 105,
    defaultDistance: 22,
    defaultElevation: 100,
    defaultIntensity: 3,
    description: 'SL 1h45 : 45min EF + 30min allure marathon (Z3) + 30min EF.',
    tags: ['marathon', 'spécifique', 'route'],
    defaultZones: [
      main(45, 2, '45min EF'),
      main(30, 3, '30min allure marathon'),
      main(30, 2, '30min EF'),
    ],
  },

  // === Tempo / Allure marathon (3) ===
  {
    id: 'te-tempo-30',
    type: 'seuil_tempo',
    title: 'Tempo continu 30min',
    defaultDuration: 60,
    defaultDistance: 10,
    defaultIntensity: 3,
    description: 'WU 20min + 30min continu allure tempo (Z3) + CD 10min.',
    tags: ['tempo'],
    defaultZones: [
      warmup(),
      main(30, 3, '30min tempo'),
      cooldown(),
    ],
  },
  {
    id: 'te-2x15',
    type: 'seuil_tempo',
    title: '2×15min tempo',
    defaultDuration: 65,
    defaultDistance: 11,
    defaultIntensity: 3,
    description: 'WU 20min + 2×15min tempo R=3min trot + CD 10min.',
    tags: ['tempo'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 2,
        effort: effortStep({ durationMin: 15, intensity: 3, label: '15min tempo' }),
        recovery: recoveryStep({ durationMin: 3, label: 'Trot 3min' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'te-am-45',
    type: 'seuil_tempo',
    title: 'Allure marathon 45min',
    defaultDuration: 75,
    defaultDistance: 13,
    defaultIntensity: 3,
    description: 'WU 20min + 45min continu allure marathon (Z3) + CD 10min.',
    tags: ['marathon', 'tempo'],
    defaultZones: [
      warmup(),
      main(45, 3, '45min allure marathon'),
      cooldown(),
    ],
  },

  // === Seuil (6) ===
  {
    id: 'se-4x8',
    type: 'seuil_tempo',
    title: '4×8min Seuil',
    defaultDuration: 65,
    defaultDistance: 11,
    defaultIntensity: 4,
    description: 'WU 20min + 4×8min seuil R=2min trot + CD 10min.',
    tags: ['seuil'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 4,
        effort: effortStep({ durationMin: 8, intensity: 4, label: '8min seuil' }),
        recovery: recoveryStep({ durationMin: 2, label: 'Trot 2min' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'se-3x10',
    type: 'seuil_tempo',
    title: '3×10min Seuil',
    defaultDuration: 65,
    defaultDistance: 11,
    defaultIntensity: 4,
    description: 'WU 20min + 3×10min seuil R=2min trot + CD 10min.',
    tags: ['seuil'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 3,
        effort: effortStep({ durationMin: 10, intensity: 4, label: '10min seuil' }),
        recovery: recoveryStep({ durationMin: 2, label: 'Trot 2min' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'se-2x20',
    type: 'seuil_tempo',
    title: '2×20min Seuil',
    defaultDuration: 75,
    defaultDistance: 13,
    defaultIntensity: 4,
    description: 'WU 20min + 2×20min seuil R=3min trot + CD 10min. Séance clé semi.',
    tags: ['seuil', 'long'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 2,
        effort: effortStep({ durationMin: 20, intensity: 4, label: '20min seuil' }),
        recovery: recoveryStep({ durationMin: 3, label: 'Trot 3min' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'se-6x6',
    type: 'seuil_tempo',
    title: '6×6min Seuil',
    defaultDuration: 70,
    defaultDistance: 12,
    defaultIntensity: 4,
    description: 'WU 20min + 6×6min seuil R=1min30 trot + CD 10min.',
    tags: ['seuil'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 6,
        effort: effortStep({ durationMin: 6, intensity: 4, label: '6min seuil' }),
        recovery: recoveryStep({ durationMin: 1.5, label: 'Trot 1min30' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'te-40min',
    type: 'seuil_tempo',
    title: 'Tempo 40min continu',
    defaultDuration: 70,
    defaultDistance: 12,
    defaultIntensity: 4,
    description: 'WU 20min + 40min continu allure seuil bas + CD 10min.',
    tags: ['tempo', 'seuil'],
    defaultZones: [
      warmup(),
      main(40, 4, '40min seuil bas'),
      cooldown(),
    ],
  },
  {
    id: 'se-2x4km-semi',
    type: 'seuil_tempo',
    title: '2×4km allure semi',
    defaultDuration: 70,
    defaultDistance: 12,
    defaultIntensity: 4,
    description: 'WU 20min + 2×4km allure semi R=4min trot + CD 10min. Séance clé semi.',
    tags: ['seuil', 'semi', 'route'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 2,
        effort: effortStep({ distanceM: 4000, intensity: 4, label: '4km allure semi' }),
        recovery: recoveryStep({ durationMin: 4, label: 'Trot 4min' }),
      }),
      cooldown(),
    ],
  },

  // === VMA courte (4) ===
  {
    id: 'fr-30-30',
    type: 'fractionne',
    title: '20×30/30',
    defaultDuration: 50,
    defaultDistance: 7,
    defaultIntensity: 5,
    description: 'WU 20min + 20×(30s VMA / 30s trot) + CD 10min.',
    tags: ['VMA', 'court'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 20,
        effort: effortStep({ durationMin: 0.5, intensity: 5, label: '30s VMA' }),
        recovery: recoveryStep({ durationMin: 0.5, label: 'Trot 30s' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'fr-45-15',
    type: 'fractionne',
    title: '12×45/15',
    defaultDuration: 50,
    defaultDistance: 7,
    defaultIntensity: 5,
    description: 'WU 20min + 12×(45s VMA / 15s trot) + CD 10min.',
    tags: ['VMA', 'court'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 12,
        effort: effortStep({ durationMin: 0.75, intensity: 5, label: '45s VMA' }),
        recovery: recoveryStep({ durationMin: 0.25, label: 'Trot 15s' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'fr-10x200',
    type: 'fractionne',
    title: '10×200m',
    defaultDuration: 55,
    defaultDistance: 7,
    defaultIntensity: 5,
    description: 'WU 20min + 10×200m R=1min trot + CD 10min. Allure VMA.',
    tags: ['VMA', 'piste', 'court'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 10,
        effort: effortStep({ distanceM: 200, intensity: 5, label: '200m VMA' }),
        recovery: recoveryStep({ durationMin: 1, label: 'Trot 1min' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'fr-15x300',
    type: 'fractionne',
    title: '15×300m',
    defaultDuration: 65,
    defaultDistance: 9,
    defaultIntensity: 5,
    description: 'WU 20min + 15×300m R=45s trot + CD 10min. Allure VMA.',
    tags: ['VMA', 'piste'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 15,
        effort: effortStep({ distanceM: 300, intensity: 5, label: '300m VMA' }),
        recovery: recoveryStep({ durationMin: 0.75, label: 'Trot 45s' }),
      }),
      cooldown(),
    ],
  },

  // === VMA longue (6) ===
  {
    id: 'fr-10x400',
    type: 'fractionne',
    title: '10×400m VMA',
    defaultDuration: 65,
    defaultDistance: 9,
    defaultIntensity: 5,
    description: 'WU 20min + 10×400m R=1min trot + CD 10min. Allure VMA (95–100%).',
    tags: ['VMA', 'piste'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 10,
        effort: effortStep({ distanceM: 400, intensity: 5, label: '400m VMA' }),
        recovery: recoveryStep({ durationMin: 1, label: 'Trot 1min' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'fr-6x500',
    type: 'fractionne',
    title: '6×500m VMA',
    defaultDuration: 60,
    defaultDistance: 8,
    defaultIntensity: 5,
    description: 'WU 20min + 6×500m R=1min15 trot + CD 10min. Allure 95–100% VMA.',
    tags: ['VMA', 'piste'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 6,
        effort: effortStep({ distanceM: 500, intensity: 5, label: '500m VMA' }),
        recovery: recoveryStep({ durationMin: 1.25, label: 'Trot 1min15' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'fr-5x1000',
    type: 'fractionne',
    title: '5×1000m VMA',
    defaultDuration: 70,
    defaultDistance: 10,
    defaultIntensity: 5,
    description: 'WU 20min + 5×1000m R=2min trot + CD 10min. Allure VMA.',
    tags: ['VMA', 'piste', 'long'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 5,
        effort: effortStep({ distanceM: 1000, intensity: 5, label: '1000m VMA' }),
        recovery: recoveryStep({ durationMin: 2, label: 'Trot 2min' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'fr-4x1500-5k',
    type: 'fractionne',
    title: '4×1500m allure 5km',
    defaultDuration: 75,
    defaultDistance: 11,
    defaultIntensity: 5,
    description: 'WU 20min + 4×1500m R=2min30 trot + CD 10min. Allure 5km.',
    tags: ['VMA', 'long', 'piste'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 4,
        effort: effortStep({ distanceM: 1500, intensity: 5, label: '1500m allure 5km' }),
        recovery: recoveryStep({ durationMin: 2.5, label: 'Trot 2min30' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'fr-3x6min',
    type: 'fractionne',
    title: '3×6min VMA',
    defaultDuration: 65,
    defaultDistance: 10,
    defaultIntensity: 5,
    description: 'WU 20min + 3×6min R=2min30 trot + CD 10min. Allure 92–95% VMA.',
    tags: ['VMA', 'long'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 3,
        effort: effortStep({ durationMin: 6, intensity: 5, label: '6min VMA' }),
        recovery: recoveryStep({ durationMin: 2.5, label: 'Trot 2min30' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'fr-5x3min',
    type: 'fractionne',
    title: '5×3min VMA',
    defaultDuration: 65,
    defaultDistance: 10,
    defaultIntensity: 5,
    description: 'WU 20min + 5×3min R=1min30 trot + CD 10min. Allure VMA.',
    tags: ['VMA'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 5,
        effort: effortStep({ durationMin: 3, intensity: 5, label: '3min VMA' }),
        recovery: recoveryStep({ durationMin: 1.5, label: 'Trot 1min30' }),
      }),
      cooldown(),
    ],
  },

  // === Côtes (6) ===
  {
    id: 'co-10x30s',
    type: 'cotes',
    title: '10×30s côtes raides',
    defaultDuration: 55,
    defaultDistance: 8,
    defaultElevation: 200,
    defaultIntensity: 5,
    description: 'WU 20min + 10×30s côte raide récup descente trot + CD 10min.',
    tags: ['côtes', 'court', 'puissance'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 10,
        effort: effortStep({ durationMin: 0.5, intensity: 5, label: '30s côte' }),
        recovery: recoveryStep({ durationMin: 1, label: 'Descente trot' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'co-12x45s',
    type: 'cotes',
    title: '12×45s côtes',
    defaultDuration: 60,
    defaultDistance: 9,
    defaultElevation: 250,
    defaultIntensity: 5,
    description: 'WU 20min + 12×45s côte récup descente trot 1min15 + CD 10min.',
    tags: ['côtes', 'puissance'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 12,
        effort: effortStep({ durationMin: 0.75, intensity: 5, label: '45s côte' }),
        recovery: recoveryStep({ durationMin: 1.25, label: 'Descente trot' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'co-6x2min',
    type: 'cotes',
    title: '6×2min côtes',
    defaultDuration: 70,
    defaultDistance: 10,
    defaultElevation: 350,
    defaultIntensity: 4,
    description: 'WU 20min + 6×2min côte modérée R=2min descente trot + CD 10min.',
    tags: ['côtes', 'seuil'],
    defaultZones: [
      warmup(),
      repeat({
        repeats: 6,
        effort: effortStep({ durationMin: 2, intensity: 4, label: '2min côte' }),
        recovery: recoveryStep({ durationMin: 2, label: 'Descente trot' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'co-4x4min',
    type: 'cotes',
    title: '4×4min côtes longues',
    defaultDuration: 80,
    defaultDistance: 11,
    defaultElevation: 400,
    defaultIntensity: 4,
    description: 'WU 25min + 4×4min côte modérée R=3min descente trot + CD 10min. Séance clé trail.',
    tags: ['côtes', 'long', 'seuil'],
    defaultZones: [
      warmup(25),
      repeat({
        repeats: 4,
        effort: effortStep({ durationMin: 4, intensity: 4, label: '4min côte' }),
        recovery: recoveryStep({ durationMin: 3, label: 'Descente trot' }),
      }),
      cooldown(),
    ],
  },
  {
    id: 'co-bosses-natu',
    type: 'cotes',
    title: 'Sortie bosses 1h30',
    defaultDuration: 90,
    defaultDistance: 13,
    defaultElevation: 600,
    defaultIntensity: 3,
    description: 'Parcours naturel à bosses, relances libres en côtes (Z3).',
    tags: ['côtes', 'spécifique', 'trail'],
    defaultZones: [main(90, 3, 'Relances libres en bosses')],
  },
  {
    id: 'co-bosses-2h',
    type: 'cotes',
    title: 'Sortie bosses 2h',
    defaultDuration: 120,
    defaultDistance: 17,
    defaultElevation: 800,
    defaultIntensity: 3,
    description: 'Parcours naturel à bosses 2h, relances libres en côtes (Z3).',
    tags: ['côtes', 'spécifique', 'trail', 'long'],
    defaultZones: [main(120, 3, 'Relances libres en bosses')],
  },

  // === Course (3) ===
  {
    id: 'cr-cible',
    type: 'course',
    title: 'Course objectif',
    defaultDuration: 240,
    defaultIntensity: 4,
    description: 'Course cible. Distance, D+ et durée à personnaliser.',
    tags: ['objectif'],
    defaultZones: [main(240, 4, 'Course')],
  },
  {
    id: 'cr-prep',
    type: 'course',
    title: 'Course de prépa',
    defaultDuration: 90,
    defaultDistance: 15,
    defaultElevation: 600,
    defaultIntensity: 4,
    description: 'Course intermédiaire en mode test grandeur nature.',
    tags: ['prépa', 'test'],
    defaultZones: [main(90, 4, 'Course de prépa')],
  },
  {
    id: 'cr-test-10k',
    type: 'course',
    title: 'Test 10km route',
    defaultDuration: 50,
    defaultDistance: 10,
    defaultIntensity: 5,
    description: 'Test 10km route à fond. Indicateur VMA / allure seuil.',
    tags: ['test', 'route', '10km'],
    defaultZones: [main(50, 5, 'Test 10km')],
  },

  // === Cross-training (5) ===
  {
    id: 'velo-1h30-eb',
    type: 'velo',
    title: 'Vélo 1h30 endurance',
    defaultDuration: 90,
    defaultDistance: 40,
    defaultElevation: 300,
    defaultIntensity: 2,
    description: 'Sortie vélo en endurance fondamentale.',
    tags: ['vélo', 'endurance'],
    defaultZones: [main(90, 2)],
  },
  {
    id: 'velo-2h-vallonne',
    type: 'velo',
    title: 'Vélo 2h vallonnée',
    defaultDuration: 120,
    defaultDistance: 55,
    defaultElevation: 800,
    defaultIntensity: 3,
    description: 'Vélo avec parcours vallonné, allure soutenue.',
    tags: ['vélo', 'côtes'],
    defaultZones: [main(120, 3)],
  },
  {
    id: 'vt-1h',
    type: 'velotaf',
    title: 'Velotaf 1h',
    defaultDuration: 60,
    defaultDistance: 20,
    defaultIntensity: 2,
    description: 'Trajet vélo modéré, récupération active.',
    tags: ['velotaf', 'transport', 'récup'],
    defaultZones: [main(60, 2)],
  },
  {
    id: 'nat-45min-endurance',
    type: 'natation',
    title: 'Natation 45min continue',
    defaultDuration: 45,
    defaultDistance: 2,
    defaultIntensity: 2,
    description: 'Crawl continu en endurance, récupération active.',
    tags: ['natation', 'crawl', 'récup'],
    defaultZones: [main(45, 2)],
  },
  {
    id: 'nat-1h-fract',
    type: 'natation',
    title: 'Natation 1h fractionnée',
    defaultDuration: 60,
    defaultDistance: 2.5,
    defaultIntensity: 4,
    description: '16×50m allure soutenue R=15s. Renforcement cardio.',
    tags: ['natation', 'fractionné'],
    defaultZones: [
      repeat({
        repeats: 16,
        effort: effortStep({ distanceM: 50, intensity: 4, label: '50m allure' }),
        recovery: recoveryStep({ durationMin: 0.25, label: 'R 15s' }),
      }),
    ],
  },

  // === Runtaf (2) ===
  {
    id: 'rt-aller',
    type: 'runtaf',
    title: 'Runtaf aller 30min',
    defaultDuration: 30,
    defaultDistance: 5,
    defaultIntensity: 2,
    description: 'Trajet domicile-travail à pied, endurance.',
    tags: ['runtaf', 'transport'],
    defaultZones: [main(30, 2)],
  },
  {
    id: 'rt-double',
    type: 'runtaf',
    title: 'Runtaf A/R 1h',
    defaultDuration: 60,
    defaultDistance: 10,
    defaultIntensity: 2,
    description: 'Trajet aller + retour à pied.',
    tags: ['runtaf', 'transport'],
    defaultZones: [main(60, 2)],
  },

  // === Renfo / Musculation (4) ===
  {
    id: 'renfo-30min-trail',
    type: 'renfo',
    title: 'Renfo trail 30min',
    defaultDuration: 30,
    defaultIntensity: 3,
    description: 'Gainage + spécifique pieds-chevilles-quadri pour trail.',
    tags: ['renfo', 'gainage', 'trail'],
  },
  {
    id: 'renfo-45min-complet',
    type: 'renfo',
    title: 'Renfo complet 45min',
    defaultDuration: 45,
    defaultIntensity: 3,
    description: 'Circuit complet : gainage, squats, fentes, pompes.',
    tags: ['renfo', 'circuit'],
  },
  {
    id: 'muscu-jambes',
    type: 'musculation',
    title: 'Muscu jambes',
    defaultDuration: 60,
    defaultIntensity: 4,
    description: 'Squat, presse, fentes, mollets. Charges modérées, séries longues.',
    tags: ['musculation', 'jambes'],
  },
  {
    id: 'muscu-haut-corps',
    type: 'musculation',
    title: 'Muscu haut du corps',
    defaultDuration: 45,
    defaultIntensity: 3,
    description: 'Pectoraux, dos, épaules, biceps, triceps. Travail complémentaire.',
    tags: ['musculation', 'haut du corps'],
  },
]
