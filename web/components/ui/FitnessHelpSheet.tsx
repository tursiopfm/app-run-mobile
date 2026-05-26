'use client'

import { KpiHelpSheet, type KpiHelpRow } from './KpiHelpSheet'
import { colors } from '@/lib/design/colors'
import type { FitnessStatusId } from '@/lib/analytics/charge-kpi-status'
import { useT } from '@/lib/i18n/I18nProvider'

const ZONE_COLORS: Record<FitnessStatusId, string> = {
  'building':    colors.subtleText,
  'progressing': colors.seriesBlue,
  'solid':       colors.seriesGreen,
  'very-solid':  colors.seriesGreen,
}

type Props = {
  currentId: FitnessStatusId
  onClose:   () => void
}

export function FitnessHelpSheet({ currentId, onClose }: Props) {
  const spec = useT().charge.helpSheet.fitness
  const order: FitnessStatusId[] = ['building', 'progressing', 'solid', 'very-solid']
  const rows: (KpiHelpRow & { id: FitnessStatusId })[] = order.map(id => ({
    id,
    color: ZONE_COLORS[id],
    ...spec.rows[id],
  }))
  return (
    <KpiHelpSheet
      title={spec.title}
      intro={spec.intro}
      rows={rows}
      currentId={currentId}
      onClose={onClose}
    />
  )
}
