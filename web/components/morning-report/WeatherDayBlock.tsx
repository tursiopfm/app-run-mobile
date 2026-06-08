'use client'

import type { WeatherResponse, WeatherHourly } from '@/lib/weather/open-meteo'

type Props =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: WeatherResponse }

const TARGET_HOURS = [8, 12, 16, 20] as const

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '🌨️'
  if (code <= 82) return '🌧️'
  if (code <= 99) return '⛈️'
  return '⛅'
}

function hourFromISO(iso: string): number {
  return parseInt(iso.slice(11, 13), 10)
}

function pickHour(hourly: WeatherHourly[], targetHour: number): WeatherHourly | null {
  let best: WeatherHourly | null = null
  let bestDiff = Infinity
  for (const h of hourly) {
    const hour = hourFromISO(h.time)
    const diff = Math.abs(hour - targetHour)
    if (diff < bestDiff) { best = h; bestDiff = diff }
  }
  return best
}

export function WeatherDayBlock(props: Props) {
  const periods = props.status === 'ready'
    ? TARGET_HOURS.map(h => {
        const slot = pickHour(props.data.hourly, h)
        return { h: `${h}h`, icon: slot ? weatherEmoji(slot.weatherCode) : '—', temp: slot ? `${slot.tempC}°` : '—°' }
      })
    : TARGET_HOURS.map(h => ({ h: `${h}h`, icon: '—', temp: '—°' }))

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] flex flex-col">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-body-sm font-semibold text-trail-muted">Météo journée</h3>
      </div>
      <div className="flex-1 grid grid-cols-4 gap-1.5 content-center">
        {periods.map(p => (
          <div key={p.h} className="rounded-[8px] py-1.5 text-center bg-trail-surface">
            <p className="text-[10px] text-trail-muted">{p.h}</p>
            <p className="text-h2 leading-none mt-1">{p.icon}</p>
            <p className="text-[16px] leading-none mt-1 text-trail-text" style={{ fontFamily: "var(--font-data)" }}>{p.temp}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
