'use client'

// Mirror of BlockType.CumulMonths from DashboardScreen.kt.
// Multi-line chart: each line = one calendar month's cumulative km by day.
// X-axis = day of month (1..31). Lines from MonthSeries[].

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Customized,
} from 'recharts'
import { colors } from '@/lib/design/colors'
import { chart } from '@/lib/design/layout'
import { useChartTooltipDismiss } from '@/lib/charts/use-chart-tooltip-dismiss'

export type MonthSeries = {
  label:      string    // "Jan 2025"
  color:      string    // hex
  dailyCumul: number[]  // cumulative km for each day 1..N
}

type Props = {
  months:  MonthSeries[]
  height?: number
  mode?:   'month' | 'year'
}

// Day-of-year of each month start (non-leap calendar — close enough for tick positions).
const MONTH_TICK_DAYS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
const MONTH_TICK_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

// Étiquettes de fin de courbe rendues en UNE passe (via <Customized>) pour pouvoir
// les espacer entre elles quand deux mois finissent à des valeurs proches, et les
// poser sur une pastille de fond dans la marge droite → jamais illisibles sur un tracé.
// On lit les points déjà calculés par recharts (formattedGraphicalItems) : positions
// pixel exactes, alignées sur les tracés (pas de recalcul d'échelle band/point). La
// couleur et la clé viennent de l'élément <Line> source (gi.item.props), les points
// de gi.props.points.
type LinePoint = { x?: number; y?: number; value?: number | null }
type GraphicalItem = {
  item?: { props?: { dataKey?: string; stroke?: string } }
  props?: { points?: LinePoint[] }
}
type EndLabelsProps = {
  cardBg: string
  formattedGraphicalItems?: GraphicalItem[]
  offset?: { top: number; height: number }
}

function EndLabels({ cardBg, formattedGraphicalItems, offset }: EndLabelsProps) {
  if (!formattedGraphicalItems || !offset) return null

  type Pt = { key: string; color: string; value: number; px: number; py: number; ly: number }
  const pts: Pt[] = []
  formattedGraphicalItems.forEach((gi, idx) => {
    const color = gi?.item?.props?.stroke
    const key = gi?.item?.props?.dataKey
    const points = gi?.props?.points
    if (!color || !points?.length) return
    // Dernier point réel (les séries plus courtes ont des points null en fin de tableau).
    let last: LinePoint | null = null
    for (let i = points.length - 1; i >= 0; i--) {
      const pt = points[i]
      if (pt && pt.value != null && pt.x != null && pt.y != null) { last = pt; break }
    }
    if (!last) return
    pts.push({ key: String(key ?? idx), color, value: Math.round(last.value as number), px: last.x!, py: last.y!, ly: last.y! })
  })
  if (pts.length === 0) return null

  // Anti-chevauchement vertical, par groupe de courbes finissant au même x.
  const top = offset.top + 7
  const bot = offset.top + offset.height - 3
  const GAP = 13
  const groups = new Map<number, Pt[]>()
  for (const p of pts) {
    const k = Math.round(p.px / 6)
    const g = groups.get(k)
    if (g) g.push(p)
    else groups.set(k, [p])
  }
  for (const g of Array.from(groups.values())) {
    g.sort((a, b) => a.py - b.py)
    for (let i = 1; i < g.length; i++) {
      if (g[i].ly < g[i - 1].ly + GAP) g[i].ly = g[i - 1].ly + GAP
    }
    const overflow = g[g.length - 1].ly - bot
    if (overflow > 0) for (const p of g) p.ly -= overflow
    for (const p of g) p.ly = Math.max(top, Math.min(bot, p.ly))
  }

  return (
    <g>
      {pts.map((p) => {
        const txt = String(p.value)
        const w = txt.length * 6 + 8
        const lx = p.px + 6
        return (
          <g key={p.key}>
            <circle cx={p.px} cy={p.py} r={3} fill={p.color} />
            <rect x={lx - 3} y={p.ly - 8} width={w} height={16} rx={4} fill={cardBg} opacity={0.9} />
            <text x={lx} y={p.ly} textAnchor="start" dominantBaseline="central"
              fontSize={10} fontWeight={700} fill={p.color}>
              {txt}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function CockpitCumulChart({ months, height = 220, mode = 'month' }: Props) {
  const maxDays = Math.max(...months.map((m) => m.dailyCumul.length), 0)
  const wrapperRef = useChartTooltipDismiss()

  if (maxDays === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <span className="text-caption text-trail-muted">Aucune donnée</span>
      </div>
    )
  }

  const data = Array.from({ length: maxDays }, (_, i) => {
    const point: Record<string, number | string> = { day: i + 1 }
    for (const m of months) {
      if (i < m.dailyCumul.length) point[m.label] = m.dailyCumul[i]
    }
    return point
  })

  return (
    <div ref={wrapperRef} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: chart.topPad, right: 40, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: colors.subtleText }}
            {...(mode === 'year'
              ? {
                  ticks: MONTH_TICK_DAYS.filter((d) => d <= maxDays),
                  tickFormatter: (v: number) => {
                    const idx = MONTH_TICK_DAYS.indexOf(v)
                    return idx >= 0 ? MONTH_TICK_LABELS[idx] : ''
                  },
                }
              : { interval: 4 })}
            stroke={colors.border}
            tickLine={false}
            height={20}
          />
          <YAxis
            tick={{ fontSize: 12, fill: colors.subtleText }}
            stroke="none"
            tickLine={false}
            axisLine={false}
            tickCount={chart.yTickCount}
            width={34}
          />
          <Tooltip
            contentStyle={{
              background:   colors.cardBg,
              border:       `1px solid ${colors.border}`,
              borderRadius: 6,
              fontSize:     12,
            }}
            labelStyle={{ color: colors.subtleText }}
            labelFormatter={(v) => (mode === 'year' ? `Jour ${v} de l'année` : `Jour ${v}`)}
            itemStyle={{ color: colors.text }}
          />
          {months.map((m) => (
            <Line
              key={m.label}
              type="monotone"
              dataKey={m.label}
              stroke={m.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          <Customized component={<EndLabels cardBg={colors.cardBg} />} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
