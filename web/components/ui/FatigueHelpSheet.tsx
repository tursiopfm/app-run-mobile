'use client'

import { KpiHelpSheet, type KpiHelpRow } from './KpiHelpSheet'
import { colors } from '@/lib/design/colors'
import type { FatigueStatusId } from '@/lib/analytics/charge-kpi-status'

const ROWS: (KpiHelpRow & { id: FatigueStatusId })[] = [
  {
    id:      'high',
    label:   'Élevée',
    range:   'ATL > 115 % du CTL',
    meaning: "Ta charge sur 7 jours dépasse nettement ta charge habituelle.",
    advice:  "Mode prudence — privilégie la récupération, évite les enchaînements de séances dures. Une journée vraiment facile (footing court) ou de repos est souvent salutaire.",
    color:   colors.seriesOrange,
  },
  {
    id:      'usual',
    label:   'Habituelle',
    range:   '85 % ≤ ATL ≤ 115 % du CTL',
    meaning: "Charge récente alignée avec ta moyenne d'entraînement.",
    advice:  "Continue ton programme normalement. C'est la zone de fonctionnement saine pour progresser sans casser.",
    color:   colors.subtleText,
  },
  {
    id:      'low',
    label:   'Modérée',
    range:   'ATL < 85 % du CTL',
    meaning: "Tu as moins chargé que d'habitude sur 7 jours.",
    advice:  "Utile en phase d'affûtage avant une course, ou en récupération après un gros bloc. Si involontaire (maladie, voyage), relance progressivement (+10 % max par semaine).",
    color:   colors.seriesBlue,
  },
]

const INTRO =
  "La Fatigue récente (ATL — Acute Training Load) résume la charge accumulée " +
  "sur les 7 derniers jours. On la compare à ta base de forme (CTL) pour savoir " +
  "si tu charges au-dessus, en-dessous ou dans la norme."

type Props = {
  currentId: FatigueStatusId
  onClose:   () => void
}

export function FatigueHelpSheet({ currentId, onClose }: Props) {
  return (
    <KpiHelpSheet
      title="Fatigue récente — que faire ?"
      intro={INTRO}
      rows={ROWS}
      currentId={currentId}
      onClose={onClose}
    />
  )
}
