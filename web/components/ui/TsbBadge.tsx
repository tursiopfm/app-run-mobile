// Badge "État de forme" — seuils et libellés alignés sur l'onglet Charge
// (kpiStatusFreshness + L.kpiStatus.freshness, source unique de vérité).

import { charge as L } from '@/lib/design/labels'
import { kpiStatusFreshness } from '@/lib/analytics/charge-kpi-status'

type TsbBadgeProps = {
  tsb: number
}

export function TsbBadge({ tsb }: TsbBadgeProps) {
  const { id, color } = kpiStatusFreshness(tsb)
  const label = L.kpiStatus.freshness[id]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-[5px] text-[15px] font-semibold leading-none border"
      style={{
        backgroundColor: `${color}1F`, // ~12% opacity, adapts to both themes
        color,
        borderColor:     `${color}59`, // ~35% opacity
      }}
    >
      {label}
    </span>
  )
}
