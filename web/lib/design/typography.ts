// Mirror of font sizes/weights used in KpiTiles.kt, Charts.kt, WeekTable.kt.
// Values in pixels (1sp ≈ 1px at mdpi default density).

export const fontSize = {
  barStripLabel:  10,  // FullWidthBarStrip inside/above labels (10sp)
  weekTableCell:  11,  // WeekTable header + body cells (11sp)
  kpiSubline:     11,  // KpiTile subline1, subline2 (11sp)
  chartAxis:      12,  // Chart x/y axis labels (12sp)
  kpiHeader:      12,  // KpiTile header title (12sp)
  sectionHeader:  12,  // Screen section headers (uppercase)
  chartTitle:     13,  // ChartCard title (13sp)
  chartValueLabel:13,  // Value labels drawn on chart (13sp)
  pieLegend:      14,  // Pie chart legend text (14sp)
  kpiValue:       20,  // KpiTile main value (20sp)
} as const

export const fontWeight = {
  normal:    400,
  semibold:  600,
  bold:      700,
} as const

// CSS class helpers — use these in className when Tailwind arbitrary values aren't available
export const tw = {
  barStripLabel:   'text-[10px] font-semibold',
  weekTableCell:   'text-[11px]',
  kpiSubline:      'text-[11px]',
  chartAxis:       'text-[12px]',
  kpiHeader:       'text-[12px] font-bold',
  sectionHeader:   'text-[12px] font-semibold uppercase tracking-wide',
  chartTitle:      'text-[13px] font-semibold',
  chartValueLabel: 'text-[13px] font-bold',
  pieLegend:       'text-[14px]',
  kpiValue:        'text-[20px] font-bold',
} as const
