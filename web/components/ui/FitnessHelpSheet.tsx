'use client'

import { KpiHelpSheet, type KpiHelpRow } from './KpiHelpSheet'
import { colors } from '@/lib/design/colors'
import type { FitnessStatusId } from '@/lib/analytics/charge-kpi-status'

const ROWS: (KpiHelpRow & { id: FitnessStatusId })[] = [
  {
    id:      'building',
    label:   'À construire',
    range:   'CTL < 20',
    meaning: "Ta base d'entraînement est encore basse (reprise, début de cycle ou pratique épisodique).",
    advice:  "Vise la régularité plutôt que l'intensité : 3 à 4 séances par semaine, surtout en endurance. Construire un CTL solide demande plusieurs semaines.",
    color:   colors.subtleText,
  },
  {
    id:      'progressing',
    label:   'En progression',
    range:   '20 ≤ CTL < 40',
    meaning: "Tu construis ta base. Bon niveau pour t'entraîner régulièrement.",
    advice:  "Continue d'augmenter le volume progressivement (≤ +10 % par semaine), introduis des séances qualité une fois par semaine.",
    color:   colors.seriesBlue,
  },
  {
    id:      'solid',
    label:   'Solide',
    range:   '40 ≤ CTL < 60',
    meaning: "Base d'entraînement solide. Tu peux encaisser des grosses séances et des semaines chargées.",
    advice:  "Idéal pour préparer une compétition. Affine les séances de qualité (seuil, VMA, SL spécifique) et soigne la récupération entre les blocs.",
    color:   colors.seriesGreen,
  },
  {
    id:      'very-solid',
    label:   'Très solide',
    range:   'CTL ≥ 60',
    meaning: "Niveau d'entraînement élevé, typique d'athlète préparé pour des objectifs ambitieux.",
    advice:  "À ce niveau, gérer la fatigue compte autant que charger. Insère des semaines d'allègement régulières pour rester dans le vert sur la fraîcheur.",
    color:   colors.seriesGreen,
  },
]

const INTRO =
  "La Base de forme (CTL — Chronic Training Load) reflète ton niveau " +
  "d'entraînement construit progressivement sur les ~42 derniers jours. " +
  "Plus elle est haute, plus tu peux absorber de la charge et progresser."

type Props = {
  currentId: FitnessStatusId
  onClose:   () => void
}

export function FitnessHelpSheet({ currentId, onClose }: Props) {
  return (
    <KpiHelpSheet
      title="Base de forme — que faire ?"
      intro={INTRO}
      rows={ROWS}
      currentId={currentId}
      onClose={onClose}
    />
  )
}
