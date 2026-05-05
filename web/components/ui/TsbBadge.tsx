// Mirror of TsbBadge composable in DashboardScreen.kt (line 6255).
// Color-coded pill showing training freshness state.

import { charge } from '@/lib/design/labels'

type TsbBadgeProps = {
  tsb: number
}

type BadgeStyle = {
  bg:   string
  fg:   string
  label: string
}

function getBadgeStyle(tsb: number): BadgeStyle {
  if (tsb >= 10)  return { bg: '#0C2A4A', fg: '#38BDF8', label: charge.veryFresh }
  if (tsb >= 0)   return { bg: '#0A2E1E', fg: '#4ADE80', label: charge.fit }
  if (tsb >= -10) return { bg: '#2A1F00', fg: '#FBBF24', label: charge.moderate }
  return              { bg: '#2A0A0A', fg: '#F87171', label: charge.tired }
}

export function TsbBadge({ tsb }: TsbBadgeProps) {
  const { bg, fg, label } = getBadgeStyle(tsb)
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-[5px] text-[15px] font-semibold leading-none border"
      style={{
        backgroundColor: bg,
        color:           fg,
        borderColor:     `${fg}59`, // ~35% opacity
      }}
    >
      {label}
    </span>
  )
}
