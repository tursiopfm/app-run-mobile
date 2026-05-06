// Structural dimensions for charts and fixed-size components.
// Mirrors padding/dimension constants from Charts.kt.

export const chart = {
  // Canvas padding (px) — from Charts.kt constants
  leftPad:         40,
  rightPad:        10,
  rightPadCombo:   44,   // ComboBarLineChart uses dual Y-axis (right label space)
  topPad:          35,   // LineChart (increased for label room)
  topPadBar:       18,   // BarChart
  topPadCombo:     30,   // ComboBarLineChart
  bottomPadLabels: 86,   // With rotated x-axis labels
  bottomPadNoLabels: 12, // Without x-axis labels

  // Default chart card height
  minHeight:       180,
  areaChartHeight: 192,

  // Chart visual params
  strokeWidth:     4,    // Series line stroke (px)
  dotRadius:       5.5,  // Line series dot radius (px)
  barWidthRatio:   0.55, // Bar width as fraction of slot width
  comboBarRatio:   0.72, // ComboBarLineChart bar width ratio
  pieRingRatio:    0.55, // Donut ring thickness as fraction of radius
  yTickCount:      5,    // Default number of Y-axis grid lines
  comboYTickCount: 4,    // ComboBarLineChart Y-axis ticks

  // X-label rotation
  xLabelRotation: -40,   // degrees (LineChart, BarChart)
  comboLabelRotation: -45, // degrees (ComboBarLineChart)
  xLabelOffset:   68,    // px offset below chart bottom for rotated labels
} as const

export const weekTable = {
  sessionColWidth: 90,   // px (col "Session")
  dayColWidth:     92,   // px (per day column)
  totalColWidth:   70,   // px (col "Total")
  headerHeight:    28,   // px
  bodyHeight:      26,   // px
} as const

export const barStrip = {
  height:  26,   // px (FullWidthBarStrip canvas height)
  gap:      2,   // px between bars
  minBarH: 13,   // px — threshold: label inside vs above bar
  cornerR:  2,   // px rounded corner
} as const

export const pieChart = {
  canvasSize:  150,  // px (square canvas)
  canvasPad:     4,  // px internal padding
} as const

// Max content width (mobile-first, centered on desktop)
export const maxContentWidth = 'max-w-lg mx-auto'
