import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        trail: {
          // Base surfaces (mirror of DarkTrailPalette in Color.kt)
          bg:           '#0A0F0E',  // background
          surface:      '#111A18',  // surface
          card:         '#162420',  // cardBg
          border:       '#1E3530',  // border
          header:       '#101917',  // headerBg
          muted:        '#8BA8A3',  // subtleText
          text:         '#E2ECE9',  // text

          // Brand / semantic colors
          primary:      '#FF6B35',  // chargeOrange (run, KPI accent)
          'primary-dim':'#CC5528',
          accent:       '#38BDF8',  // seriesBlue / bikeBlack
          success:      '#4ADE80',  // greenOk
          warning:      '#FBBF24',  // seriesYellow / pieSeuil
          danger:       '#F87171',  // runRed / seriesRed
          'pale-green': '#0A2E1E',  // paleGreen

          // Pie chart segment colors (from Color.kt)
          'pie-cotes':       '#8B5CF6',  // pieCotes (Côtes/Hills)
          'pie-footing':     '#F59E0B',  // pieFooting
          'pie-autre':       '#6B8A85',  // pieAutre

          // Progress bar backgrounds (from Color.kt)
          'progress-run-bg':    '#243530',  // progressRunBg
          'progress-volume-bg': '#13211E',  // progressVolumeBg
          'progress-dplus-bg':  '#11232A',  // progressDPlusBg
        },
      },
      fontSize: {
        // Named font sizes from Android (sp → px, 1sp = 1px at mdpi)
        '10':  ['10px', { lineHeight: '1.2' }],
        '11':  ['11px', { lineHeight: '1.3' }],
        '13':  ['13px', { lineHeight: '1.4' }],
        '14':  ['14px', { lineHeight: '1.4' }],
        '20':  ['20px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        // Named radii from Android RoundedCornerShape values
        'kpi':   '4px',   // KpiTile (4dp)
        'chart': '6px',   // ChartCard (6dp)
        'bar':   '2px',   // ProgressRow / BarStrip (2dp)
      },
      height: {
        'week-header': '28px',  // WeekTable.HeaderCell
        'week-body':   '26px',  // WeekTable.BodyCell
        'bar-strip':   '26px',  // FullWidthBarStrip
        'progress':    '16px',  // ProgressRow bar
      },
      minHeight: {
        'chart':      '180px', // ChartCard default
        'chart-area': '192px', // AreaChart
      },
      width: {
        'week-session': '90px',
        'week-day':     '92px',
        'week-total':   '70px',
        'pie-canvas':   '150px',
      },
    },
  },
  plugins: [],
}

export default config
