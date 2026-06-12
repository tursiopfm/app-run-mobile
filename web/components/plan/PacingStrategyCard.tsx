'use client'

// Bloc « Stratégie d'allure » — curseur parlant (Finir fort ↔ Partir vite), façon
// PacePro. Replié par défaut : l'athlète l'ouvre s'il veut régler. Dépliée : curseur
// + courbe d'allure (step-line) sur le profil D+ CUMULÉ, axes chiffrés (allure /
// dénivelé) et tooltip de valeurs au survol. Pilote pacingFade (alimente aussi
// WaypointsTable). Style scoped (même pattern que WaypointsTable).

import { useMemo, useState } from 'react'
import { segmentPaces } from '@/lib/plan/pacing'
import { useT } from '@/lib/i18n/I18nProvider'

type PlanDict = ReturnType<typeof useT>['plan']

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
  // Objectif / départ affichés à droite du titre, cliquables (popups d'édition).
  startTime?: string
  onEditObjective?: () => void
  onEditStart?: () => void
}

const clampFade = (f: number) => Math.max(-FADE_MAX, Math.min(FADE_MAX, f))
const sliderFromFade = (f: number) => Math.round((clampFade(f) / FADE_MAX) * 100)
const fadeFromSlider = (v: number) => clampFade((v / 100) * FADE_MAX)

const fmtPace = (s: number): string => {
  const t = Math.round(s) // arrondir AVANT de découper, sinon 779,5 → « 12:60 »
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
const fmtKm = (k: number) => (Number.isInteger(k) ? String(k) : k.toFixed(1).replace('.', ','))

// --- Courbe interactive : allure (orange) sur profil D+ cumulé (bleu), axes + tooltip ---
function PaceCurve({
  waypoints, totalSec, fade, L,
}: { waypoints: PacingStrategyWaypoint[]; totalSec: number; fade: number; L: PlanDict }) {
  const [hover, setHover] = useState<number | null>(null)

  const model = useMemo(() => {
    const n = waypoints.length
    if (n < 2) return null
    const totalKm = waypoints[n - 1].km - waypoints[0].km
    if (totalKm <= 0) return null
    const W = 300, H = 120, padX = 4, padTop = 10, padBot = 10
    const usable = H - padTop - padBot
    const x = (km: number) => padX + ((km - waypoints[0].km) / totalKm) * (W - 2 * padX)
    const maxDp = Math.max(1, waypoints[n - 1].dPlus ?? 0)
    const elevY = (dp: number) => padTop + (1 - dp / maxDp) * usable

    let elevArea = `M ${x(waypoints[0].km).toFixed(1)} ${H} `
    waypoints.forEach((w) => { elevArea += `L ${x(w.km).toFixed(1)} ${elevY(w.dPlus ?? 0).toFixed(1)} ` })
    elevArea += `L ${x(waypoints[n - 1].km).toFixed(1)} ${H} Z`

    const paces = segmentPaces(waypoints, { totalDurationSec: totalSec, fade })
    const seg = paces.slice(1)
    const pMin = Math.min(...seg), pMax = Math.max(...seg)
    const span = Math.max(1, pMax - pMin)
    const paceY = (p: number) => padTop + ((p - pMin) / span) * usable

    let paceLine = ''
    const segs: { i: number; x0: number; x1: number; midPct: number; yv: number; kmA: number; kmB: number; pace: number; cumDp: number }[] = []
    for (let i = 1; i < n; i++) {
      const x0 = x(waypoints[i - 1].km), x1 = x(waypoints[i].km)
      const yv = paceY(paces[i])
      paceLine += `${i === 1 ? 'M' : 'L'} ${x0.toFixed(1)} ${yv.toFixed(1)} L ${x1.toFixed(1)} ${yv.toFixed(1)} `
      segs.push({
        i, x0, x1, yv, midPct: ((x0 + x1) / 2 / W) * 100,
        kmA: waypoints[i - 1].km, kmB: waypoints[i].km,
        pace: paces[i], cumDp: waypoints[i].dPlus ?? 0,
      })
    }
    return { H, elevArea, paceLine, segs, pMin, pMax, maxDp, totalKm }
  }, [waypoints, totalSec, fade])

  if (!model) return null
  const hv = hover != null ? model.segs.find((s) => s.i === hover) ?? null : null
  const cx = hv ? (hv.x0 + hv.x1) / 2 : 0

  return (
    <div className="pcv">
      <div className="pcv-legend">
        <span><i style={{ background: 'var(--trail-primary)' }} />{L.pacingCurveLegendPace}</span>
        <span><i style={{ background: '#38BDF8' }} />{L.pacingCurveLegendElev}</span>
      </div>
      <div className="pcv-row">
        <div className="pcv-yL"><span>{fmtPace(model.pMin)}</span><span>{fmtPace(model.pMax)}</span></div>
        <div className="pcv-svg" onMouseLeave={() => setHover(null)}>
          <svg className="pcurve" viewBox="0 0 300 120" preserveAspectRatio="none">
            <path d={model.elevArea} fill="rgba(56,189,248,.14)" stroke="rgba(56,189,248,.5)" strokeWidth={1} />
            <path d={model.paceLine} fill="none" stroke="var(--trail-primary)" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
            {hv && <line x1={cx} x2={cx} y1={0} y2={120} stroke="var(--trail-text)" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.5} />}
            {hv && <circle cx={cx} cy={hv.yv} r={3.2} fill="var(--trail-primary)" />}
            {model.segs.map((s) => (
              <rect key={s.i} x={s.x0} y={0} width={Math.max(0.5, s.x1 - s.x0)} height={120}
                fill="transparent" style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(s.i)} onClick={() => setHover(s.i)} />
            ))}
          </svg>
          {hv && (
            <div className="pcv-tip" style={{ left: `${hv.midPct}%` }}>
              <b>km {fmtKm(hv.kmA)}–{fmtKm(hv.kmB)}</b>
              <span style={{ color: 'var(--trail-primary)' }}>{fmtPace(hv.pace)} /km</span>
              <span style={{ color: '#38BDF8' }}>D+ {hv.cumDp} m</span>
            </div>
          )}
        </div>
        <div className="pcv-yR"><span>{model.maxDp} m</span><span>0</span></div>
      </div>
      <div className="pcv-x">
        <span>0 km</span><span>{Math.round(model.totalKm / 2)} km</span><span>{Math.round(model.totalKm)} km</span>
      </div>
    </div>
  )
}

export function PacingStrategyCard({
  waypoints, targetDurationMin, pacingFade, onChange, readOnly,
  startTime, onEditObjective, onEditStart,
}: Props) {
  const L = useT().plan
  const totalSec = targetDurationMin * 60
  const fade = clampFade(pacingFade ?? 0)
  // Variante de couleur du badge : régulier=gris · finir fort=bleu · partir vite=orange.
  const variant = Math.abs(fade) < 0.08 ? 'even' : fade < 0 ? 'start' : 'end'
  const objLabel = `${Math.floor(targetDurationMin / 60)}h${String(targetDurationMin % 60).padStart(2, '0')}`

  const phrase = useMemo(() => {
    if (Math.abs(fade) < 0.08) return L.pacingPhraseEven
    const pct = Math.round((Math.abs(fade) / FADE_MAX) * 100)
    const intensity = pct < 40 ? L.pacingIntLight : pct < 75 ? L.pacingIntModerate : L.pacingIntStrong
    return fade < 0 ? L.pacingPhraseNeg(intensity) : L.pacingPhrasePos(intensity)
  }, [fade, L])

  const curLabel = Math.abs(fade) < 0.08 ? L.pacingScaleMid : fade < 0 ? L.pacingScaleStart : L.pacingScaleEnd

  return (
    <details className="pstrat rounded-[12px] bg-trail-card border border-trail-border p-4 mb-3">
      <style>{`
        .pstrat{--d:var(--font-display,'Space Grotesk',sans-serif);}
        .pstrat > summary{list-style:none;}
        .pstrat summary::-webkit-details-marker{display:none;}
        .pstrat .psum{display:flex;align-items:center;gap:8px;cursor:pointer;flex-wrap:wrap;}
        .pstrat .psum-title{font-family:var(--d);font-weight:600;font-size:12.5px;color:var(--trail-muted);}
        .pstrat .psum-right{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
        .pstrat .psum-goal{font-family:var(--d);font-size:11px;color:var(--trail-muted);white-space:nowrap;}
        .pstrat .psum-val{font-family:var(--d);font-weight:700;font-size:12px;color:var(--trail-text);background:none;border:0;border-bottom:1px dashed var(--trail-muted);padding:0 1px;cursor:pointer;}
        .pstrat .psum-val:hover{color:var(--trail-primary);border-bottom-color:var(--trail-primary);}
        .pstrat .psum-cur{font-family:var(--d);font-weight:700;font-size:12px;border-radius:7px;padding:2px 8px;white-space:nowrap;border:1px solid transparent;}
        .pstrat .psum-cur.v-even{color:var(--trail-muted);background:rgba(127,127,127,.12);border-color:var(--trail-border);}
        .pstrat .psum-cur.v-start{color:#38BDF8;background:rgba(56,189,248,.12);border-color:rgba(56,189,248,.35);}
        .pstrat .psum-cur.v-end{color:var(--trail-primary);background:rgba(255,107,53,.1);border-color:rgba(255,107,53,.28);}
        .pstrat .psum-chev{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--trail-surface);border:1px solid var(--trail-border);color:var(--trail-text);font-size:12px;line-height:1;transition:transform .2s,background .2s;}
        .pstrat .psum:hover .psum-chev{background:var(--trail-border);}
        .pstrat[open] .psum-chev{transform:rotate(180deg);}
        .pstrat .pbody{margin-top:14px;}
        .pstrat .prange{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:6px;outline:none;cursor:pointer;
          background:linear-gradient(90deg,#38BDF8 0%,var(--trail-border) 50%,var(--trail-primary) 100%);}
        .pstrat .prange::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--trail-text);border:3px solid var(--trail-card);box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:grab;}
        .pstrat .prange::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--trail-text);border:3px solid var(--trail-card);cursor:grab;}
        .pstrat .prange:disabled{opacity:.6;cursor:default;}
        .pstrat .pscale{display:flex;justify-content:space-between;font-size:9.5px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--trail-muted);margin-bottom:6px;font-family:var(--d);}
        .pstrat .pscale .mid{color:var(--trail-text);}
        .pstrat .pcv{margin-top:14px;border-radius:10px;background:var(--trail-surface);border:1px solid var(--trail-border);padding:8px;}
        .pstrat .pcv-legend{display:flex;gap:12px;font-size:9.5px;font-weight:600;color:var(--trail-muted);margin-bottom:5px;padding:0 2px;font-family:var(--d);}
        .pstrat .pcv-legend i{display:inline-block;width:10px;height:3px;border-radius:2px;margin-right:4px;vertical-align:middle;}
        .pstrat .pcv-row{display:flex;align-items:stretch;gap:5px;}
        .pstrat .pcv-yL,.pstrat .pcv-yR{display:flex;flex-direction:column;justify-content:space-between;font-size:8.5px;font-weight:700;font-family:var(--d);padding:1px 0;}
        .pstrat .pcv-yL{align-items:flex-end;color:var(--trail-primary);min-width:24px;}
        .pstrat .pcv-yR{align-items:flex-start;color:#38BDF8;min-width:30px;}
        .pstrat .pcv-svg{position:relative;flex:1;height:120px;min-width:0;}
        .pstrat .pcurve{width:100%;height:120px;display:block;}
        .pstrat .pcv-x{display:flex;justify-content:space-between;font-size:9px;color:var(--trail-muted);padding-top:3px;margin:0 30px 0 24px;font-family:var(--d);}
        .pstrat .pcv-tip{position:absolute;top:-4px;transform:translateX(-50%);background:var(--trail-card);border:1px solid var(--trail-border);border-radius:7px;padding:4px 8px;display:flex;flex-direction:column;gap:1px;font-size:9.5px;font-weight:600;font-family:var(--d);white-space:nowrap;pointer-events:none;box-shadow:0 6px 16px rgba(0,0,0,.45);z-index:2;}
        .pstrat .pcv-tip b{color:var(--trail-text);font-weight:700;}
        .pstrat .pmethod{margin-top:14px;border-top:1px solid var(--trail-border);padding-top:10px;}
        .pstrat .pmethod > summary{list-style:none;cursor:pointer;font-family:var(--d);font-weight:600;font-size:11.5px;color:#38BDF8;}
        .pstrat .pmethod-formula{font-family:var(--d);font-weight:700;color:var(--trail-text);background:var(--trail-surface);border:1px solid var(--trail-border);border-radius:7px;padding:6px 9px;margin:8px 0;display:inline-block;font-size:12px;}
      `}</style>

      <summary className="psum">
        <span className="psum-title">{L.pacingTitle}</span>
        <div className="psum-right">
          {(onEditObjective || onEditStart) && (
            <span className="psum-goal">
              {onEditObjective && (
                <>Objectif <button type="button" className="psum-val"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditObjective() }}>{objLabel}</button></>
              )}
              {onEditStart && (
                <>{onEditObjective ? ' · ' : ''}Départ <button type="button" className="psum-val"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditStart() }}>{startTime ? startTime.slice(0, 5) : '—'}</button></>
              )}
            </span>
          )}
          <span className={`psum-cur v-${variant}`}>{curLabel}</span>
          <span className="psum-chev" aria-hidden>▾</span>
        </div>
      </summary>

      <div className="pbody">
        <div className="pscale">
          <span>{L.pacingScaleStart}</span>
          <span className="mid">{L.pacingScaleMid}</span>
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

        <PaceCurve waypoints={waypoints} totalSec={totalSec} fade={fade} L={L} />

        <details className="pmethod">
          <summary>{L.pacingMethodSummary}</summary>
          <div className="mt-2 text-caption text-trail-muted leading-relaxed">
            <div className="pmethod-formula">{L.pacingMethodFormula}</div>
            <p>{L.pacingMethodBody}</p>
          </div>
        </details>
      </div>
    </details>
  )
}
