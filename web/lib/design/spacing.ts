// Mirror of padding/margin/gap values from KpiTiles.kt, Charts.kt, DashboardScreen.kt.
// Values in pixels. Tailwind equivalents provided as comments.

export const spacing = {
  // Screen-level
  screenPaddingX:    16,  // px-4
  screenPaddingY:    16,  // py-4
  blockGap:           8,  // gap-2 / space-y-2

  // Card / ChartCard
  cardPaddingX:      10,  // px-2.5
  cardPaddingY:       8,  // py-2
  cardTitleGap:       6,  // mt-1.5 (gap between title and chart canvas)

  // KpiTile header band
  kpiHeaderPaddingX:  8,  // px-2
  kpiHeaderPaddingY:  4,  // py-1

  // KpiTile body
  kpiBodyPaddingX:   10,  // px-2.5
  kpiBodyPaddingY:    8,  // py-2
  kpiSublineGap1:     2,  // mt-0.5 (subline1 below value)
  kpiSublineGap2:     4,  // mt-1   (subline2 below subline1)

  // Grid
  kpiGridGap:         8,  // gap-2

  // ProgressRow
  progressBarHeight: 16,  // h-4
  progressLabelGap:   4,  // mt-1

  // WeekTable cells
  weekTableCellPaddingX: 6,  // px-1.5
  weekTableHeaderHeight: 28, // h-7
  weekTableBodyHeight:   26, // h-[26px]

  // BarStrip
  barStripHeight:    26,  // h-[26px]
  barStripGap:        2,  // gap-0.5 (2px between bars)

  // Pie chart
  pieCanvasSize:    150,  // w-[150px] h-[150px]
  pieLegendGap:       4,  // gap-1
  pieLegendDotSize:  10,  // w-2.5 h-2.5 (10px dot)
  pieLegendDotTextGap: 6, // gap-1.5
} as const

// Tailwind class shorthands for direct className use
export const tw = {
  screenPadding:  'px-4 py-4',
  blockGap:       'space-y-2',
  card:           'px-2.5 py-2',
  kpiHeader:      'px-2 py-1',
  kpiBody:        'px-2.5 py-2',
  kpiGrid:        'grid grid-cols-2 gap-2',
  progressBar:    'h-4',
  barStrip:       'h-[26px]',
  weekHeader:     'h-7',
  weekBody:       'h-[26px]',
} as const
