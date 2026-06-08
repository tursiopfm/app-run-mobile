'use client'

import type { WeatherResponse } from '@/lib/weather/open-meteo'

type Props =
  | { status: 'loading'; locationLabel?: string | null }
  | { status: 'error'; locationLabel?: string | null }
  | { status: 'ready'; data: WeatherResponse; locationLabel?: string | null }

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

function uvLabel(uv: number): { label: string; color: string } {
  if (uv <= 2) return { label: 'faible',     color: 'rgba(74,222,128,1)' }
  if (uv <= 5) return { label: 'modéré',     color: 'rgba(251,191,36,1)' }
  if (uv <= 7) return { label: 'élevé',      color: 'rgba(255,107,53,1)' }
  if (uv <= 10) return { label: 'très élevé', color: 'rgba(248,113,113,1)' }
  return { label: 'extrême', color: 'rgba(139,92,246,1)' }
}

function airLabel(aqi: number): { label: string; color: string } {
  if (aqi <= 20) return { label: 'très bon', color: 'rgba(74,222,128,1)' }
  if (aqi <= 40) return { label: 'bon',      color: 'rgba(74,222,128,1)' }
  if (aqi <= 60) return { label: 'modéré',   color: 'rgba(251,191,36,1)' }
  if (aqi <= 80) return { label: 'médiocre', color: 'rgba(255,107,53,1)' }
  return { label: 'mauvais', color: 'rgba(248,113,113,1)' }
}

function formatHour(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export function WeatherCurrentBlock(props: Props) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] flex flex-col">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-body-sm font-semibold text-trail-muted">Là-dehors</h3>
        <span className="text-body">{props.status === 'ready' ? weatherEmoji(props.data.current.weatherCode) : '⛅'}</span>
      </div>

      {props.status === 'loading' && (
        <p className="text-micro text-trail-muted">Chargement météo…</p>
      )}
      {props.status === 'error' && (
        <p className="text-micro text-trail-muted">Météo indisponible.</p>
      )}
      {props.status === 'ready' && (() => {
        const c = props.data.current
        const uvL = uvLabel(props.data.uv.index)
        const airL = airLabel(props.data.airQuality.europeanAqi)
        const uvBg     = uvL.color.replace('1)', '0.12)')
        const uvBorder = uvL.color.replace('1)', '0.35)')
        const airBg    = airL.color.replace('1)', '0.12)')
        const airBorder= airL.color.replace('1)', '0.35)')
        return (
          <>
            <div className="flex items-baseline gap-1.5">
              <p className="text-display leading-none text-trail-text" style={{ fontFamily: "var(--font-data)" }}>{c.tempC}°</p>
              <p className="text-micro text-trail-muted">/{c.feelsLikeC}°</p>
            </div>
            {props.locationLabel && (
              <p className="text-[10px] mt-0.5 text-trail-muted truncate">{props.locationLabel}</p>
            )}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-3 text-micro text-trail-text">
              <div><span className="text-trail-muted">💨</span> {c.windKmh} km/h</div>
              <div><span className="text-trail-muted">💧</span> {c.precipPct}%</div>
              <div><span className="text-trail-muted">💦</span> {c.humidityPct}%</div>
              <div><span className="text-trail-muted">🌅</span> {formatHour(c.sunriseISO)}</div>
            </div>
            <div className="flex gap-1.5 mt-2.5">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-[3px] text-caption font-semibold leading-none border flex-1 justify-center"
                style={{ background: uvBg, color: uvL.color, borderColor: uvBorder }}
              >
                UV {props.data.uv.index} · {uvL.label}
              </span>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-[3px] text-caption font-semibold leading-none border flex-1 justify-center"
                style={{ background: airBg, color: airL.color, borderColor: airBorder }}
              >
                Air {props.data.airQuality.europeanAqi} · {airL.label}
              </span>
            </div>
          </>
        )
      })()}
    </div>
  )
}
