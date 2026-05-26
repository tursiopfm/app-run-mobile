'use client'

import { KpiHelpSheet, type KpiHelpRow } from './KpiHelpSheet'
import { colors } from '@/lib/design/colors'
import type { FreshnessStatusId } from '@/lib/analytics/charge-kpi-status'
import { useT } from '@/lib/i18n/I18nProvider'

const ZONE_COLORS: Record<FreshnessStatusId, string> = {
  'very-fresh':     colors.seriesBlue,
  'fresh':          colors.seriesBlue,
  'balanced':       colors.seriesGreen,
  'normal-fatigue': colors.seriesYellow,
  'high-fatigue':   colors.seriesRed,
}

type Props = {
  currentId: FreshnessStatusId
  onClose:   () => void
}

export function FreshnessHelpSheet({ currentId, onClose }: Props) {
  const spec = useT().charge.helpSheet.freshness
  const order: FreshnessStatusId[] = ['very-fresh', 'fresh', 'balanced', 'normal-fatigue', 'high-fatigue']
  const rows: (KpiHelpRow & { id: FreshnessStatusId })[] = order.map(id => ({
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
