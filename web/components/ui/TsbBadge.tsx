// Mirror of TsbBadge composable in DashboardScreen.kt (line 6255).
// Color-coded pill showing training freshness state.

import { charge } from '@/lib/design/labels'

type TsbBadgeProps = {
  tsb: number
}

type BadgeStyle = {
  fg:    string
  label: string
}

function getBadgeStyle(tsb: number): BadgeStyle {
  if (tsb >= 10)  return { fg: '#38BDF8', label: charge.veryFresh }
  if (tsb >= 0)   return { fg: '#4ADE80', label: charge.fit }
  if (tsb >= -10) return { fg: '#FBBF24', label: charge.moderate }
  return              { fg: '#F87171', label: charge.tired }
}

export function TsbBadge({ tsb }: TsbBadgeProps) {
  const { fg, label } = getBadgeStyle(tsb)
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-[5px] text-[15px] font-semibold leading-none border"
      style={{
        backgroundColor: `${fg}1F`, // ~12% opacity, adapts to both themes
        color:           fg,
        borderColor:     `${fg}59`, // ~35% opacity
      }}
    >
      {label}
    </span>
  )
}
