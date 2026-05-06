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
          bg:           'var(--trail-bg)',
          surface:      'var(--trail-surface)',
          card:         'var(--trail-card)',
          border:       'var(--trail-border)',
          header:       'var(--trail-header)',
          muted:        'var(--trail-muted)',
          text:         'var(--trail-text)',
          primary:      'var(--trail-primary)',
          'primary-dim':'var(--trail-primary-dim)',
          accent:       'var(--trail-accent)',
          success:      'var(--trail-success)',
          warning:      'var(--trail-warning)',
          danger:       'var(--trail-danger)',
          'pale-green': 'var(--trail-pale-green)',
          'pie-cotes':       'var(--trail-pie-cotes)',
          'pie-footing':     'var(--trail-pie-footing)',
          'pie-autre':       'var(--trail-pie-autre)',
          'progress-run-bg':    'var(--trail-progress-run-bg)',
          'progress-volume-bg': 'var(--trail-progress-volume-bg)',
          'progress-dplus-bg':  'var(--trail-progress-dplus-bg)',
        },
      },
      fontSize: {
        '10':  ['10px', { lineHeight: '1.2' }],
        '11':  ['11px', { lineHeight: '1.3' }],
        '13':  ['13px', { lineHeight: '1.4' }],
        '14':  ['14px', { lineHeight: '1.4' }],
        '20':  ['20px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        'kpi':   '4px',
        'chart': '6px',
        'bar':   '2px',
      },
      height: {
        'week-header': '28px',
        'week-body':   '26px',
        'bar-strip':   '26px',
        'progress':    '16px',
      },
      minHeight: {
        'chart':      '180px',
        'chart-area': '192px',
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
