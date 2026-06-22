'use client'

// Profil altimétrique d'une course (Option A) : aire Recharts tracée depuis les
// waypoints. Altitude absolue si la source la fournit (LiveTrail), sinon relative
// reconstruite (d+ − d−). Index des points alignés sur l'ordre des waypoints
// → highlight croisé avec WaypointsTable via hoveredIndex / onHoverIndex.
import { useMemo } from 'react'
import {
  AreaChart, ComposedChart, Area, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Customized,
} from 'recharts'
import { resolveAltitudes } from '@/lib/plan/waypoint-view'
import { colors } from '@/lib/design/colors'
import type { WaypointSupply } from '@/types/plan'
import { chartChips, SUPPLY_META } from '@/lib/plan/supply-chips'

export interface ProfileWaypoint {
  km: number
  name: string
  altitude: number | null
  dPlus: number | null
  dMoins: number | null
  supplies: WaypointSupply[]
  cutoffRaw: string | null
}
export interface ProfilePoint { km: number; alt: number | null; name: string }

export function buildProfileData(
  wps: ProfileWaypoint[],
): { mode: 'absolute' | 'relative'; points: ProfilePoint[] } {
  const { mode, values } = resolveAltitudes(
    wps.map((w) => ({ altitude: w.altitude, dPlus: w.dPlus, dMoins: w.dMoins })),
  )
  return { mode, points: wps.map((w, i) => ({ km: w.km, alt: values[i], name: w.name })) }
}

export function exploitableCount(points: ProfilePoint[]): number {
  return points.filter((p) => p.alt != null).length
}

export function interpolateAlt(d: number[], e: number[], km: number): number | null {
  if (d.length === 0) return null
  if (km <= d[0]) return e[0]
  if (km >= d[d.length - 1]) return e[e.length - 1]
  for (let i = 1; i < d.length; i++) {
    if (d[i] >= km) {
      const t = (km - d[i - 1]) / ((d[i] - d[i - 1]) || 1)
      return e[i - 1] + (e[i] - e[i - 1]) * t
    }
  }
  return e[e.length - 1]
}

export interface DenseMarker {
  km: number; alt: number; wpIndex: number; name: string
  chips: WaypointSupply[]; stackBase: number
}
const STACK_BASE_LOW = 44   // px : bas de la colonne de puces (cas normal)
const STACK_BASE_HIGH = 30  // px : décalé vers le haut pour un ravito proche du précédent
const PROXIMITY_KM = 6

export function buildMarkers(
  waypoints: { km: number; name: string; supplies: WaypointSupply[] }[],
  profile: { d: number[]; e: number[] },
): DenseMarker[] {
  return waypoints.map((w, i) => {
    const close = i > 0 && w.km - waypoints[i - 1].km < PROXIMITY_KM
    return {
      km: w.km, alt: interpolateAlt(profile.d, profile.e, w.km) ?? 0, wpIndex: i, name: w.name,
      chips: chartChips(w.supplies),
      stackBase: close ? STACK_BASE_HIGH : STACK_BASE_LOW,
    }
  })
}

const fmtKm = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',')

// Domaine Y « propre » : plancher/plafond arrondis aux 100 m, avec une marge en
// haut pour que le sommet du profil ne touche jamais le bord du cadre (sans ça,
// Recharts cale le max pile au bord et la crête déborde du graphe). Le plancher
// est ramené près du fond de vallée (pas forcé à 0) pour exploiter la hauteur.
export function elevationDomain(e: number[]): [number, number] {
  if (e.length === 0) return [0, 100]
  let min = e[0], max = e[0]
  for (const v of e) { if (v < min) min = v; if (v > max) max = v }
  const span = max - min || 100
  const lo = Math.max(0, Math.floor((min - span * 0.08) / 100) * 100)
  const hi = Math.ceil((max + span * 0.12) / 100) * 100
  return [lo, hi]
}

type Props = {
  waypoints: ProfileWaypoint[]
  denseProfile?: { d: number[]; e: number[] }
  hoveredIndex: number | null
  onHoverIndex: (i: number | null) => void
  selectedIndex?: number | null
  onSelectIndex?: (i: number) => void
}

export function ElevationProfileChart({ waypoints, denseProfile, hoveredIndex, onHoverIndex, selectedIndex = null, onSelectIndex }: Props) {
  const { mode, points } = useMemo(() => buildProfileData(waypoints), [waypoints])

  // Mode dense : si une trace est attachée (≥ 2 points), elle prime sur l'escalier.
  if (denseProfile && denseProfile.d.length >= 2) {
    const data = denseProfile.d.map((km, i) => ({ km, alt: denseProfile.e[i] }))
    const [yMin, yMax] = elevationDomain(denseProfile.e)
    const markers = buildMarkers(
      waypoints.map((w) => ({ km: w.km, name: w.name, supplies: w.supplies })), denseProfile,
    )
    const ORANGE = colors.chargeOrange
    const CHIP_W = 10, CHIP_H = 10, CHIP_GAP = 1.6
    // shape custom : connecteur + colonne de puces (nourriture en haut) + point.
    const renderMarker = (p: { cx?: number; cy?: number; payload?: DenseMarker }) => {
      if (p.cx == null || p.cy == null || !p.payload) return <g />
      const m = p.payload
      const active = m.wpIndex === selectedIndex
      const hovered = m.wpIndex === hoveredIndex
      const base = m.stackBase
      // colonne empilée (chartChips déjà ordonné food, BV, A) → on inverse pour
      // poser la nourriture EN HAUT et A près du point.
      const stack = [...m.chips].reverse()
      const chipsSvg = stack.map((c, i) => {
        const w = SUPPLY_META[c].letter.length > 1 ? 13 : CHIP_W
        const y = base - (i + 1) * CHIP_H - i * CHIP_GAP
        return (
          <g key={c}>
            <rect x={p.cx! - w / 2} y={y} width={w} height={CHIP_H} rx={2.4} fill={SUPPLY_META[c].color} />
            <text x={p.cx} y={y + 7.4} fontSize={6.6} fontWeight={700} fill="#fff" textAnchor="middle">{SUPPLY_META[c].letter}</text>
          </g>
        )
      })
      return (
        <g>
          <line x1={p.cx} y1={base} x2={p.cx} y2={p.cy}
            stroke={active ? ORANGE : colors.seriesBlue} strokeWidth={active ? 1.4 : 1}
            strokeDasharray={active ? '3 3' : undefined} opacity={active ? 0.8 : 0.4} />
          {chipsSvg}
          <circle cx={p.cx} cy={p.cy} r={active ? 6 : hovered ? 4.5 : 3}
            fill={active ? ORANGE : colors.seriesBlue} stroke="#fff" strokeWidth={active ? 2 : 1} />
        </g>
      )
    }
    // Effet « courbes de niveau » : copies de la courbe décalées vers le bas en
    // pixels, opacité dégressive, dessinées SOUS l'aire (calque). Customized donne
    // accès aux échelles px de Recharts (responsive) ; clippé à la zone de plot.
    const renderRidges = (cp: any) => {
      const xMap = cp?.xAxisMap, yMap = cp?.yAxisMap, off = cp?.offset
      const xs = xMap && xMap[Object.keys(xMap)[0]]?.scale
      const ys = yMap && yMap[Object.keys(yMap)[0]]?.scale
      if (!xs || !ys || !off) return null
      const pts = data.map((d) => [xs(d.km), ys(d.alt)] as [number, number])
      if (pts.length < 2) return null
      const N = 13, gap = 4.2
      const layers = []
      for (let k = N; k >= 1; k--) {
        const dy = k * gap
        const seg = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${(p[1] + dy).toFixed(1)}`).join(' ')
        layers.push(
          <path key={k} d={seg} fill="none" stroke={colors.seriesBlue} strokeWidth={1.1}
            opacity={Number((0.5 * (1 - k / (N + 5))).toFixed(3))} />,
        )
      }
      return (
        <g>
          <defs>
            <clipPath id="elevRidgeClip">
              <rect x={off.left} y={off.top} width={off.width} height={off.height} />
            </clipPath>
          </defs>
          <g clipPath="url(#elevRidgeClip)">{layers}</g>
        </g>
      )
    }
    // Bulle de sélection : km + altitude du point sélectionné, ancrée sur la
    // courbe, qui SUIT la sélection (clic point / ligne tableau / nav ‹ ›). Calque
    // au-dessus du reste ; Customized donne les échelles px + la largeur du plot
    // (clamp horizontal pour ne pas sortir du cadre).
    const renderSelectionBubble = (cp: any) => {
      if (selectedIndex == null) return null
      const wp = waypoints[selectedIndex]
      if (!wp) return null
      const xMap = cp?.xAxisMap, yMap = cp?.yAxisMap, off = cp?.offset
      const xs = xMap && xMap[Object.keys(xMap)[0]]?.scale
      const ys = yMap && yMap[Object.keys(yMap)[0]]?.scale
      if (!xs || !ys || !off) return null
      const alt = interpolateAlt(denseProfile.d, denseProfile.e, wp.km) ?? 0
      const px = xs(wp.km), py = ys(alt)
      const label = `km ${fmtKm(wp.km)} · ${Math.round(alt)} m`
      const w = label.length * 5.6 + 14, h = 17
      const lx = Math.max(off.left, Math.min(px - w / 2, off.left + off.width - w))
      const ly = Math.max(off.top, py - h - 9)
      return (
        <g>
          <rect x={lx} y={ly} width={w} height={h} rx={8.5} fill={ORANGE} />
          <text x={lx + w / 2} y={ly + 12} fontSize={10} fontWeight={600} fill="#fff" textAnchor="middle">{label}</text>
          <circle cx={px} cy={py} r={6.5} fill={ORANGE} stroke="#fff" strokeWidth={2} />
        </g>
      )
    }
    return (
      <div style={{ width: '100%', height: 230 }} onMouseLeave={() => onHoverIndex(null)}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 50, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="elevFillDense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.seriesBlue} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colors.seriesBlue} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={colors.border} strokeDasharray="2 2" />
            <XAxis dataKey="km" type="number" domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => `${fmtKm(v)}`}
              tick={{ fontSize: 10, fill: colors.subtleText }} />
            <YAxis width={42} domain={[yMin, yMax]} allowDecimals={false}
              tick={{ fontSize: 10, fill: colors.subtleText }} />
            <Tooltip
              cursor={{ stroke: colors.border, strokeDasharray: '3 3' }}
              content={(tp: { active?: boolean; label?: number; payload?: Array<{ name?: string; value?: number }> }) => {
                if (!tp?.active || !tp.payload?.length) return null
                // Area ET Scatter partagent dataKey "alt" → on ne garde que l'aire
                // (name "Altitude") pour ne pas afficher deux altitudes.
                const e = tp.payload.find((x) => x?.name === 'Altitude') ?? tp.payload[0]
                if (e?.value == null) return null
                return (
                  <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 12, padding: '4px 8px', borderRadius: 6 }}>
                    <div style={{ color: colors.text }}>{`km ${fmtKm(tp.label ?? 0)}`}</div>
                    <div style={{ color: colors.seriesBlue }}>{`${Math.round(e.value)} m`}</div>
                  </div>
                )
              }}
            />
            <Customized component={renderRidges} />
            <Area dataKey="alt" name="Altitude" type="linear" stroke={colors.seriesBlue} strokeWidth={2}
              fill="url(#elevFillDense)" dot={false} activeDot={false} />
            <Scatter data={markers} dataKey="alt" shape={renderMarker}
              onClick={(d: any) => onSelectIndex?.(d?.wpIndex ?? d?.payload?.wpIndex)}
              onMouseEnter={(d: any) => onHoverIndex(d?.wpIndex ?? d?.payload?.wpIndex ?? null)}
              onMouseLeave={() => onHoverIndex(null)} />
            <Customized component={renderSelectionBubble} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (exploitableCount(points) < 2) {
    return (
      <div className="h-[160px] rounded-[8px] bg-trail-surface border border-dashed border-trail-border flex items-center justify-center">
        <p className="text-caption text-trail-muted">Profil indisponible</p>
      </div>
    )
  }

  // Dot custom : visible uniquement sur l'index survolé (highlight venant du tableau).
  const renderDot = (p: { cx?: number; cy?: number; index?: number }) => {
    if (p.cx == null || p.cy == null || p.index !== hoveredIndex) return <g key={p.index} />
    return (
      <circle key={p.index} cx={p.cx} cy={p.cy} r={5}
        fill={colors.seriesBlue} stroke="#fff" strokeWidth={1.5} />
    )
  }

  return (
    <div style={{ width: '100%', height: 180 }}
      onMouseLeave={() => onHoverIndex(null)}>
      {mode === 'relative' && (
        <p className="text-micro text-trail-muted mb-1">Altitude relative au départ</p>
      )}
      <ResponsiveContainer>
        <AreaChart
          data={points}
          margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
          onMouseMove={(s: { activeTooltipIndex?: number }) =>
            onHoverIndex(typeof s?.activeTooltipIndex === 'number' ? s.activeTooltipIndex : null)}
        >
          <defs>
            <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.seriesBlue} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colors.seriesBlue} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.border} strokeDasharray="2 2" />
          <XAxis dataKey="km" type="number" domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => `${fmtKm(v)}`}
            tick={{ fontSize: 10, fill: colors.subtleText }} />
          <YAxis width={42} tick={{ fontSize: 10, fill: colors.subtleText }} />
          <Tooltip
            contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 12 }}
            labelStyle={{ color: colors.text }}
            labelFormatter={(v: number) => `km ${fmtKm(v)}`}
            formatter={(value: number, _n, item: { payload?: ProfilePoint }) =>
              [`${Math.round(value)} m`, item?.payload?.name ?? '']}
          />
          <Area dataKey="alt" type="linear" connectNulls
            stroke={colors.seriesBlue} strokeWidth={2}
            fill="url(#elevFill)" dot={renderDot} activeDot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
