import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        trail: {
          bg:           '#0f1117',
          surface:      '#1a1d2e',
          card:         '#1e2235',
          border:       '#2a2f45',
          muted:        '#6b7280',
          text:         '#e8eaf0',
          primary:      '#f97316',
          'primary-dim':'#c2410c',
          accent:       '#22d3ee',
          success:      '#4ade80',
          warning:      '#facc15',
          danger:       '#f87171',
        },
      },
    },
  },
  plugins: [],
}

export default config
