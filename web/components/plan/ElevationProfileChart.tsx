'use client'

// Profil altimétrique d'une course (Option A) : aire Recharts tracée depuis les
// waypoints. Altitude absolue si la source la fournit (LiveTrail), sinon relative
// reconstruite (d+ − d−). Index des points alignés sur l'ordre des waypoints
// → highlight croisé avec WaypointsTable via hoveredIndex / onHoverIndex.
import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { resolveAltitudes } from '@/lib/plan/waypoint-view'
import { colors } from '@/lib/design/colors'

export interface ProfileWaypoint {
  km: number
  name: string
  altitude: number | null
  dPlus: number | null
  dMoins: number | null
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

const fmtKm = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',')

type Props = {
  waypoints: ProfileWaypoint[]
  hoveredIndex: number | null
  onHoverIndex: (i: number | null) => void
}

export function ElevationProfileChart({ waypoints, hoveredIndex, onHoverIndex }: Props) {
  const { mode, points } = useMemo(() => buildProfileData(waypoints), [waypoints])

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
