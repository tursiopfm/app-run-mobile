// Mirror of RoundedCornerShape values from KpiTiles.kt, Charts.kt, WeekTable.kt.
// Android 1dp ≈ 1px → direct mapping.

export const radius = {
  kpiTile:        4,   // rounded    (4px)
  chartCard:      6,   // rounded-md (6px)
  weekTable:      4,   // rounded    (4px)
  progressBar:    2,   // rounded-sm (2px)
  barStripBar:    2,   // rounded-sm (2px)
  pieLegendDot:   2,   // rounded-sm (2px)
  settingsCard:   6,   // rounded-md (6px) — same as chart card
  activityRow:    4,   // rounded    (4px)
} as const

// Tailwind class shorthands
export const tw = {
  kpiTile:      'rounded',     // 4px
  chartCard:    'rounded-md',  // 6px
  weekTable:    'rounded',     // 4px
  progressBar:  'rounded-sm',  // 2px
  barStripBar:  'rounded-sm',  // 2px
  pieDot:       'rounded-sm',  // 2px
  settingsCard: 'rounded-md',  // 6px
  activityRow:  'rounded',     // 4px
} as const
