'use client'

import { KpiHelpSheet, type KpiHelpRow } from './KpiHelpSheet'
import { colors } from '@/lib/design/colors'
import type { FatigueStatusId } from '@/lib/analytics/charge-kpi-status'
import { useT } from '@/lib/i18n/I18nProvider'

const ZONE_COLORS: Record<FatigueStatusId, string> = {
  'high':  colors.seriesOrange,
  'usual': colors.subtleText,
  'low':   colors.seriesBlue,
}

type Props = {
  currentId: FatigueStatusId
  onClose:   () => void
}

export function FatigueHelpSheet({ currentId, onClose }: Props) {
  const spec = useT().charge.helpSheet.fatigue
  const order: FatigueStatusId[] = ['high', 'usual', 'low']
  const rows: (KpiHelpRow & { id: FatigueStatusId })[] = order.map(id => ({
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
