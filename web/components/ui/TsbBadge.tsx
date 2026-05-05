import { colors } from '@/lib/design/colors'

type Props = {
  tsb: number
}

function tsbMeta(tsb: number): { label: string; color: string } {
  if (tsb >= 10)  return { label: 'Frais',     color: colors.seriesBlue }
  if (tsb >= 0)   return { label: 'Équilibré', color: colors.greenOk }
  if (tsb >= -10) return { label: 'Chargé',    color: colors.seriesYellow }
  return { label: 'Surchargé', color: colors.runRed }
}

function toHex(color: string, opacity: number): string {
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

export function TsbBadge({ tsb }: Props) {
  const meta = tsbMeta(tsb)
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-semibold leading-none"
      style={{
        backgroundColor: toHex(meta.color, 0.15),
        color:           meta.color,
        border:          `1px solid ${toHex(meta.color, 0.5)}`,
      }}
    >
      {meta.label}
      <span className="ml-1 font-medium">{Math.round(tsb)}</span>
    </span>
  )
}
