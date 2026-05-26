'use client'

// Badge "État de forme" — seuils et libellés alignés sur l'onglet Charge
// (kpiStatusFreshness + L.kpiStatus.freshness, source unique de vérité).

import { useT } from '@/lib/i18n/I18nProvider'
import { kpiStatusFreshness } from '@/lib/analytics/charge-kpi-status'

type TsbBadgeProps = {
  tsb:      number
  onClick?: () => void
}

export function TsbBadge({ tsb, onClick }: TsbBadgeProps) {
  const L = useT().charge
  const { id, color } = kpiStatusFreshness(Math.round(tsb))
  const label = L.kpiStatus.freshness[id]
  const className =
    'inline-flex items-center rounded-full px-2.5 py-[5px] text-[15px] font-semibold leading-none border'
  const style = {
    backgroundColor: `${color}1F`, // ~12% opacity, adapts to both themes
    color,
    borderColor:     `${color}59`, // ~35% opacity
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} cursor-pointer hover:brightness-110 transition`}
        style={style}
        aria-label={`Fraîcheur ${label} — voir les explications`}
      >
        {label}
      </button>
    )
  }
  return (
    <span className={className} style={style}>
      {label}
    </span>
  )
}
