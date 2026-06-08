'use client'

import { useState } from 'react'
import { splitPaceSec, fmtPaceSec } from '@/lib/activities/detail'
import type { StravaSplit } from '@/lib/activities/detail'
import { useT } from '@/lib/i18n/I18nProvider'

// ── Geometry ─────────────────────────────────────────────────────────────────
// W large volontairement : le SVG est rendu en width:100%, son ratio (W/H) fixe
// donc la hauteur affichée. Un W large → graphe plus plat, moins haut à l'écran
// (et texte/traits, en unités viewBox, moins gros sur les colonnes larges).
const W = 460, H = 172
const PAD_L = 8, PAD_R = 8
const PACE_TOP = 22, PACE_BOT = 98       // bande allure (rapide = haut)
const ELEV_TOP = 106, ELEV_BOT = 160     // silhouette dénivelé

type Pt = { x: number; y: number }

// Catmull-Rom → courbe de Bézier lissée.
function spline(pts: Pt[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }
  return d
}

export function ActivitySplitsProfile({
  splits,
  avgPaceSec,
}: {
  splits: StravaSplit[]
  avgPaceSec: number
}) {
  const L = useT().activities
  const [hover, setHover] = useState<number | null>(null)

  // Points valides indexés par distance cumulée (axe x fidèle).
  const cum: number[] = []
  let run = 0
  for (const s of splits) { run += s.distance; cum.push(run) }
  const totalM = run || 1

  const pts = splits
    .map((s, i) => ({ s, i, pace: splitPaceSec(s) }))
    .filter((p): p is { s: StravaSplit; i: number; pace: number } => p.pace !== null)

  if (pts.length < 2) return null

  const paces = pts.map(p => p.pace)
  const minP = Math.min(...paces)
  const maxP = Math.max(...paces)
  const paceRange = maxP - minP || 1

  const slowest = pts.reduce((a, b) => (b.pace > a.pace ? b : a))
  const fastest = pts.reduce((a, b) => (b.pace < a.pace ? b : a))

  // Régularité = écart-type des km « roulés » (hors gros outliers de côte).
  const steady = paces.filter(p => p <= avgPaceSec * 1.2 && p >= avgPaceSec * 0.8)
  const base = steady.length >= 2 ? steady : paces
  const mean = base.reduce((a, b) => a + b, 0) / base.length
  const sd = Math.round(Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / base.length))

  // Dénivelé cumulé.
  let e = 0
  const elevCum = splits.map(s => (e += s.elevation_difference))
  const eMin = Math.min(0, ...elevCum)
  const eMax = Math.max(0, ...elevCum)
  const eRange = (eMax - eMin) || 1

  const x = (m: number) => PAD_L + (m / totalM) * (W - PAD_L - PAD_R)
  const yPace = (p: number) => PACE_TOP + ((p - minP) / paceRange) * (PACE_BOT - PACE_TOP)
  const yElev = (v: number) => ELEV_BOT - ((v - eMin) / eRange) * (ELEV_BOT - ELEV_TOP)

  const pacePts: Pt[] = pts.map(p => ({ x: x(cum[p.i]), y: yPace(p.pace) }))
  const elevPts: Pt[] = splits.map((_, i) => ({ x: x(cum[i]), y: yElev(elevCum[i]) }))

  const paceLine = spline(pacePts)
  const paceArea = `${paceLine} L ${x(totalM)} ${PACE_BOT} L ${PAD_L} ${PACE_BOT} Z`
  const elevLine = spline(elevPts)
  const elevArea = `${elevLine} L ${x(totalM)} ${ELEV_BOT} L ${PAD_L} ${ELEV_BOT} Z`

  // Graduations distance.
  const totalKm = totalM / 1000
  const step = totalKm <= 6 ? 1 : totalKm <= 16 ? 5 : 10
  const ticks: number[] = []
  for (let k = step; k < totalKm; k += step) ticks.push(k)

  const slowElev = Math.round(slowest.s.elevation_difference)

  const callout = (label: string, value: string, hint: string, color: string) => (
    <div style={{ background: 'var(--trail-card)', border: '1px solid var(--trail-border)', borderRadius: 11, padding: 11 }}>
      <div style={{ fontSize: 10.5, color: 'var(--trail-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1, color, fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--trail-muted)', marginTop: 4 }}>{hint}</div>
    </div>
  )

  // Survol → point valide le plus proche (mappe la position curseur sur le viewBox).
  const handlePointer = (clientX: number, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect()
    if (!rect.width) return
    const svgX = ((clientX - rect.left) / rect.width) * W
    let best = 0
    let bestD = Infinity
    for (let k = 0; k < pacePts.length; k++) {
      const d = Math.abs(pacePts[k].x - svgX)
      if (d < bestD) { bestD = d; best = k }
    }
    setHover(best)
  }

  const hoverData = (() => {
    if (hover === null || hover >= pts.length) return null
    const p = pts[hover]
    const he = Math.round(p.s.elevation_difference)
    return {
      x: pacePts[hover].x,
      y: pacePts[hover].y,
      pct: Math.min(92, Math.max(8, (pacePts[hover].x / W) * 100)),
      km: p.s.split,
      pace: fmtPaceSec(p.pace),
      elevTxt: he > 0 ? `↑${he} m` : he < 0 ? `↓${Math.abs(he)} m` : '—',
      elevColor: he > 0 ? '#C7A553' : he < 0 ? '#6FA9C9' : 'var(--trail-muted)',
    }
  })()

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Section header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--trail-text)', fontWeight: 600 }}>
          {L.splitsProfileTitle(`${totalKm.toFixed(1)} km`)}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#FF8A33' }}>
          {L.splitsBest(fmtPaceSec(minP))}
        </span>
      </div>

      {/* Chart */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(24,32,43,.5), rgba(11,15,20,0))',
        border: '1px solid var(--trail-border)', borderRadius: 14, padding: '14px 6px 8px', marginBottom: 12,
      }}>
        <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={L.splitsProfileTitle(`${totalKm.toFixed(1)} km`)}
          style={{ display: 'block', cursor: 'crosshair', touchAction: 'pan-y' }}
          onMouseMove={(e) => handlePointer(e.clientX, e.currentTarget)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => handlePointer(e.touches[0].clientX, e.currentTarget)}
          onTouchMove={(e) => handlePointer(e.touches[0].clientX, e.currentTarget)}
          onTouchEnd={() => setHover(null)}
        >
          <defs>
            <linearGradient id="tc-pace-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FF7900" stopOpacity="0.42" />
              <stop offset="1" stopColor="#FF7900" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="tc-elev-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a4a52" stopOpacity="0.55" />
              <stop offset="1" stopColor="#3a4a52" stopOpacity="0.05" />
            </linearGradient>
            <filter id="tc-glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {ticks.map(k => (
            <line key={k} x1={x(k * 1000)} y1={PACE_TOP} x2={x(k * 1000)} y2={ELEV_BOT} stroke="#1c2530" strokeWidth="1" />
          ))}
          {ticks.map(k => (
            <text key={`t${k}`} x={x(k * 1000)} y={H - 2} fill="#5A6E69" fontSize="8" textAnchor="middle" style={{ fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums' }}>{k}</text>
          ))}

          {/* Elevation silhouette */}
          <path d={elevArea} fill="url(#tc-elev-g)" />
          <path d={elevLine} fill="none" stroke="#475862" strokeWidth="1.2" />

          {/* Pace */}
          <path d={paceArea} fill="url(#tc-pace-g)" />
          <path d={paceLine} fill="none" stroke="#FF7900" strokeWidth="2.4" strokeLinejoin="round" filter="url(#tc-glow)" />

          {/* Slowest marker */}
          {slowest.i !== fastest.i && (
            <>
              <circle cx={x(cum[slowest.i])} cy={yPace(slowest.pace)} r="3.5" fill="#38BDF8" />
              {slowElev > 0 && (
                <text x={x(cum[slowest.i])} y={yPace(slowest.pace) - 7} fill="#7FC6E8" fontSize="8.5" textAnchor="middle" style={{ fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums' }}>⛰ +{slowElev}</text>
              )}
            </>
          )}

          {/* Fastest marker */}
          <circle cx={x(cum[fastest.i])} cy={yPace(fastest.pace)} r="4.5" fill="#FF7900" filter="url(#tc-glow)" />
          <circle cx={x(cum[fastest.i])} cy={yPace(fastest.pace)} r="2" fill="#fff" />
          <text x={x(cum[fastest.i])} y={yPace(fastest.pace) - 8} fill="#FF8A33" fontSize="9" fontWeight="700" textAnchor="middle" style={{ fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums' }}>★ {fmtPaceSec(minP)}</text>

          {/* Hover guide + marker */}
          {hoverData && (
            <>
              <line x1={hoverData.x} y1={PACE_TOP} x2={hoverData.x} y2={ELEV_BOT} stroke="#E2ECE9" strokeOpacity="0.22" strokeWidth="1" />
              <circle cx={hoverData.x} cy={hoverData.y} r="4" fill="#fff" stroke="#FF7900" strokeWidth="2" />
            </>
          )}
        </svg>

        {/* Hover tooltip */}
        {hoverData && (
          <div style={{
            position: 'absolute', top: 2, left: `${hoverData.pct}%`, transform: 'translateX(-50%)',
            pointerEvents: 'none', zIndex: 3, whiteSpace: 'nowrap',
            background: 'var(--trail-card)', border: '1px solid var(--trail-border)',
            borderRadius: 8, padding: '6px 9px', boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--trail-muted)', marginBottom: 4 }}>km {hoverData.km}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5 }}>
              <i style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF7900', flexShrink: 0 }} />
              <span style={{ color: 'var(--trail-muted)' }}>{L.paceLabel}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#FF8A33', fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums' }}>{hoverData.pace}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, marginTop: 3 }}>
              <i style={{ width: 8, height: 8, borderRadius: '50%', background: '#3a4a52', flexShrink: 0 }} />
              <span style={{ color: 'var(--trail-muted)' }}>{L.splitsElevLabel}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: hoverData.elevColor, fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums' }}>{hoverData.elevTxt}</span>
            </div>
          </div>
        )}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 18, padding: '2px 10px 0', fontSize: 11, color: 'var(--trail-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: '#FF7900', display: 'inline-block' }} /> {L.paceLabel}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: '#3a4a52', display: 'inline-block' }} /> {L.splitsElevLabel}</span>
        </div>
      </div>

      {/* Callouts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {callout(`⚡ ${L.splitsFastest}`, fmtPaceSec(fastest.pace), `km ${fastest.s.split}`, '#FF8A33')}
        {callout(`⛰ ${L.splitsSlowest}`, fmtPaceSec(slowest.pace), `km ${slowest.s.split}${slowElev > 0 ? ` · +${slowElev} m` : ''}`, '#38BDF8')}
        {callout(`📊 ${L.splitsRegularity}`, `±${sd}s`, L.splitsRegularityHint, '#4ADE80')}
      </div>
    </div>
  )
}
