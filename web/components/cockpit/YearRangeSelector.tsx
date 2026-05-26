'use client'

import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'

const ACCENT = '#38BDF8'
const NUMERIC_PRESETS = [3, 5, 10] as const

type Props = {
  value:    number
  max:      number
  onChange: (n: number) => void
  accent?:  string
}

export function YearRangeSelector({ value, max, onChange, accent = ACCENT }: Props) {
  const L = useT().cockpit
  const safeMax  = Math.max(1, max)
  const clamped  = Math.min(Math.max(1, value), safeMax)
  const filled   = safeMax === 1 ? 100 : ((clamped - 1) / (safeMax - 1)) * 100
  const trackBg  = `linear-gradient(to right, ${accent} 0%, ${accent} ${filled}%, ${colors.border} ${filled}%, ${colors.border} 100%)`

  function pillStyle(active: boolean) {
    return {
      backgroundColor: active ? accent : 'transparent',
      color:           active ? '#fff' : colors.subtleText,
      border:          `1px solid ${active ? accent : colors.border}`,
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-[10px]">
      <div className="flex gap-1">
        {NUMERIC_PRESETS.map((n) => {
          const disabled = n > safeMax
          const active   = !disabled && clamped === n
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors disabled:cursor-not-allowed"
              style={{ ...pillStyle(active), opacity: disabled ? 0.4 : 1 }}
            >
              {n}{L.yearShortSuffix}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => onChange(safeMax)}
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors"
          style={pillStyle(clamped === safeMax)}
        >
          {L.yearAll}
        </button>
      </div>

      <div className="flex-1 flex items-center gap-2 min-w-[140px]">
        <input
          type="range"
          min={1}
          max={safeMax}
          step={1}
          value={clamped}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={L.aria.yearRange}
          className="
            flex-1 h-[14px] cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-runnable-track]:h-[2px]
            [&::-webkit-slider-runnable-track]:rounded-full
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-[14px]
            [&::-webkit-slider-thumb]:h-[14px]
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white/30
            [&::-webkit-slider-thumb]:-mt-[6px]
            [&::-webkit-slider-thumb]:bg-[var(--thumb-color)]
            [&::-moz-range-track]:h-[2px]
            [&::-moz-range-track]:rounded-full
            [&::-moz-range-thumb]:w-[14px]
            [&::-moz-range-thumb]:h-[14px]
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-white/30
            [&::-moz-range-thumb]:bg-[var(--thumb-color)]
          "
          style={{
            background: trackBg,
            ['--thumb-color' as string]: accent,
          }}
        />
        <span className="text-[11px] text-trail-muted whitespace-nowrap">
          {L.yearLabel(clamped)}
        </span>
      </div>
    </div>
  )
}
