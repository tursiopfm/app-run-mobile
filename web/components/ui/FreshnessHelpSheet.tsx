'use client'

import { KpiHelpSheet, type KpiHelpRow } from './KpiHelpSheet'
import { colors } from '@/lib/design/colors'
import type { FreshnessStatusId } from '@/lib/analytics/charge-kpi-status'

const ROWS: (KpiHelpRow & { id: FreshnessStatusId })[] = [
  {
    id:      'very-fresh',
    label:   'Très frais',
    range:   'TSB ≥ +15',
    meaning: "Tu es très reposé, ta base de fatigue est très basse.",
    advice:  "Excellente fenêtre pour une grosse séance qualité (VMA, seuil) ou une compétition. Si l'état dure plus de 2 semaines, relance progressivement le volume — risque de sous-entraînement.",
    color:   colors.seriesBlue,
  },
  {
    id:      'fresh',
    label:   'Frais',
    range:   '+5 ≤ TSB < +15',
    meaning: "Bien récupéré, prêt à encaisser une charge intense.",
    advice:  "Journée idéale pour une séance qualité : fractionné, seuil, sortie longue rythmée. Tu peux pousser sans risque.",
    color:   colors.seriesBlue,
  },
  {
    id:      'balanced',
    label:   'Équilibrée',
    range:   '−10 < TSB < +5',
    meaning: "Équilibre entre charge encaissée et récupération.",
    advice:  "Suis ton plan normalement. C'est la zone de croisière idéale pour progresser dans la durée.",
    color:   colors.seriesGreen,
  },
  {
    id:      'normal-fatigue',
    label:   'Légère fatigue',
    range:   '−25 < TSB ≤ −10',
    meaning: "Fatigue normale d'une phase de charge.",
    advice:  "Tu peux maintenir le volume mais évite d'enchaîner les séances dures. Insère un footing de récup ou une journée facile.",
    color:   colors.seriesYellow,
  },
  {
    id:      'high-fatigue',
    label:   'Fatigué',
    range:   'TSB ≤ −25',
    meaning: "Fatigue marquée — tu accumules plus vite que tu ne récupères.",
    advice:  "1 à 2 jours de repos ou séances très faciles (Z1). Pas d'intensité tant que le TSB n'est pas remonté au-dessus de −10.",
    color:   colors.seriesRed,
  },
]

const INTRO =
  "Le TSB (Training Stress Balance) mesure l'écart entre ta base de forme " +
  "(CTL — 42 jours) et ta fatigue récente (ATL — 7 jours). Il indique si tu " +
  "es plutôt frais ou plutôt fatigué aujourd'hui."

type Props = {
  currentId: FreshnessStatusId
  onClose:   () => void
}

export function FreshnessHelpSheet({ currentId, onClose }: Props) {
  return (
    <KpiHelpSheet
      title="Fraîcheur — que faire ?"
      intro={INTRO}
      rows={ROWS}
      currentId={currentId}
      onClose={onClose}
    />
  )
}
