'use client'

// Bloc « Stratégie d'allure » — curseur parlant (Finir fort ↔ Partir vite), façon
// PacePro, posé au-dessus du tableau de course. Recalcule en live une courbe
// d'allure par tronçon superposée au profil dénivelé, et pilote pacingFade (qui
// alimente aussi WaypointsTable). Style scoped (même pattern que WaypointsTable).

import { useMemo } from 'react'
import { segmentPaces } from '@/lib/plan/pacing'
import { useT } from '@/lib/i18n/I18nProvider'

const FADE_MAX = 1.2

export type PacingStrategyWaypoint = {
  km: number
  dPlus: number | null
  targetOverrideSec: number | null
}

type Props = {
  waypoints: PacingStrategyWaypoint[]
  targetDurationMin: number
  pacingFade: number
  onChange: (fade: number) => void
  readOnly?: boolean
}

const clampFade = (f: number) => Math.max(-FADE_MAX, Math.min(FADE_MAX, f))
const sliderFromFade = (f: number) => Math.round((clampFade(f) / FADE_MAX) * 100)
const fadeFromSlider = (v: number) => clampFade((v / 100) * FADE_MAX)

type CurvePaths = { elevArea: string; paceLine: string } | null

function buildCurvePaths(
  waypoints: PacingStrategyWaypoint[],
  totalSec: number,
  fade: number,
): CurvePaths {
  const n = waypoints.length
  if (n < 2) return null
  const totalKm = waypoints[n - 1].km - waypoints[0].km
  if (totalKm <= 0) return null
  const W = 300, H = 120, padX = 4
  const x = (km: number) => padX + ((km - waypoints[0].km) / totalKm) * (W - 2 * padX)

  const maxDp = Math.max(1, ...waypoints.map((w) => w.dPlus ?? 0))
  let elevArea = `M ${x(waypoints[0].km).toFixed(1)} ${H} `
  waypoints.forEach((w) => {
    const y = H - ((w.dPlus ?? 0) / maxDp) * (H * 0.55)
    elevArea += `L ${x(w.km).toFixed(1)} ${y.toFixed(1)} `
  })
  elevArea += `L ${x(waypoints[n - 1].km).toFixed(1)} ${H} Z`

  const paces = segmentPaces(waypoints, { totalDurationSec: totalSec, fade })
  const seg = paces.slice(1)
  const pMin = Math.min(...seg), pMax = Math.max(...seg)
  const span = Math.max(1, pMax - pMin)
  const yPace = (p: number) => 12 + ((p - pMin) / span) * (H * 0.6)
  let paceLine = ''
  for (let i = 1; i < n; i++) {
    const x0 = x(waypoints[i - 1].km), x1 = x(waypoints[i].km)
    const yv = yPace(paces[i])
    if (i === 1) paceLine += `M ${x0.toFixed(1)} ${yv.toFixed(1)} `
    paceLine += `L ${x1.toFixed(1)} ${yv.toFixed(1)} `
  }
  return { elevArea, paceLine }
}

export function PacingStrategyCard({
  waypoints, targetDurationMin, pacingFade, onChange, readOnly,
}: Props) {
  const L = useT().plan
  const totalSec = targetDurationMin * 60
  const fade = clampFade(pacingFade ?? 0)

  const curve = useMemo(
    () => buildCurvePaths(waypoints, totalSec, fade),
    [waypoints, totalSec, fade],
  )

  const phrase = useMemo(() => {
    if (Math.abs(fade) < 0.08) return L.pacingPhraseEven
    const pct = Math.round((Math.abs(fade) / FADE_MAX) * 100)
    const intensity = pct < 40 ? L.pacingIntLight : pct < 75 ? L.pacingIntModerate : L.pacingIntStrong
    return fade < 0 ? L.pacingPhraseNeg(intensity) : L.pacingPhrasePos(intensity)
  }, [fade, L])

  const totalKm = waypoints.length >= 2 ? waypoints[waypoints.length - 1].km - waypoints[0].km : 0

  return (
    <div className="pstrat rounded-[12px] bg-trail-card border border-trail-border p-4 mb-3">
      <style>{`
        .pstrat .prange{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:6px;outline:none;cursor:pointer;
          background:linear-gradient(90deg,#38BDF8 0%,var(--trail-border) 50%,var(--trail-primary) 100%);}
        .pstrat .prange::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--trail-text);border:3px solid var(--trail-card);box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:grab;}
        .pstrat .prange::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--trail-text);border:3px solid var(--trail-card);cursor:grab;}
        .pstrat .prange:disabled{opacity:.6;cursor:default;}
        .pstrat .pcurve{width:100%;height:120px;display:block;}
        .pstrat summary::-webkit-details-marker{display:none;}
      `}</style>

      <h2 className="text-body font-semibold text-trail-muted mb-3 font-display">{L.pacingTitle}</h2>

      <div className="flex justify-between text-[9.5px] font-semibold uppercase tracking-wide text-trail-muted mb-1.5 font-display">
        <span>{L.pacingScaleStart}</span>
        <span className="text-trail-text">{L.pacingScaleMid}</span>
        <span>{L.pacingScaleEnd}</span>
      </div>
      <input
        type="range" min={-100} max={100} step={1}
        className="prange"
        value={sliderFromFade(fade)}
        disabled={readOnly}
        onChange={(e) => onChange(fadeFromSlider(Number(e.target.value)))}
        aria-label={L.pacingTitle}
      />

      <p className="text-body-sm text-trail-text mt-3 leading-snug">{phrase}</p>

      {curve && (
        <div className="mt-3 rounded-[10px] bg-trail-surface border border-trail-border p-2">
          <div className="flex gap-3 text-[9.5px] font-semibold text-trail-muted mb-1 px-1 font-display">
            <span><i className="inline-block w-2.5 h-[3px] rounded-sm align-middle mr-1" style={{ background: 'var(--trail-primary)' }} />{L.pacingCurveLegendPace}</span>
            <span><i className="inline-block w-2.5 h-[3px] rounded-sm align-middle mr-1" style={{ background: '#38BDF8' }} />{L.pacingCurveLegendElev}</span>
          </div>
          <svg className="pcurve" viewBox="0 0 300 120" preserveAspectRatio="none">
            <path d={curve.elevArea} fill="rgba(56,189,248,.14)" stroke="rgba(56,189,248,.5)" strokeWidth={1} />
            <path d={curve.paceLine} fill="none" stroke="var(--trail-primary)" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className="flex justify-between text-[9px] text-trail-muted pt-0.5 px-0.5 font-display">
            <span>0 km</span>
            <span>{Math.round(totalKm / 2)} km</span>
            <span>{Math.round(totalKm)} km</span>
          </div>
        </div>
      )}

      <details className="mt-3 border-t border-trail-border pt-2.5">
        <summary className="cursor-pointer text-caption font-semibold font-display list-none" style={{ color: '#38BDF8' }}>
          {L.pacingMethodSummary}
        </summary>
        <div className="mt-2 text-caption text-trail-muted leading-relaxed">
          <div className="font-display font-semibold text-trail-text bg-trail-surface border border-trail-border rounded-[7px] px-2 py-1.5 my-1.5 inline-block">
            {L.pacingMethodFormula}
          </div>
          <p>{L.pacingMethodBody}</p>
        </div>
      </details>
    </div>
  )
}
