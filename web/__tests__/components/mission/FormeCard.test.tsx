import { render, screen, fireEvent } from '@testing-library/react'
import { FormeCard } from '@/components/mission/FormeCard'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'

// jsdom n'implémente pas ResizeObserver, requis par Recharts (FitnessFatigueChart).
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
;(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub

// dailyMetrics minimal : dernier point tsb -12, 8 points pour le delta
// DailyMetrics requires: date, dailyLoad, atl, ctl, tsb
const metrics = Array.from({ length: 8 }, (_, i) => ({
  date: `2026-06-0${i + 1}`,
  dailyLoad: 0,
  atl: 60,
  ctl: 48,
  tsb: i === 7 ? -12 : -15,
}))
const payload = { dailyMetrics: metrics } as unknown as ChargeSportPayload

it('badge cliquable → ouvre la fenêtre « Fraîcheur — que faire ? »', () => {
  render(<I18nProvider initialLang="fr"><FormeCard payload={payload} /></I18nProvider>)
  // TSB -12 renders as '-12' (ASCII hyphen-minus)
  expect(screen.getByText('-12')).toBeInTheDocument()
  // TsbBadge with tsb=-12 → normal-fatigue → 'Légère fatigue'
  fireEvent.click(screen.getByText('Légère fatigue'))
  expect(screen.getByText('Fraîcheur — que faire ?')).toBeInTheDocument()
})

// Payload complet (comme freshnessPayload réel issu de getChargePageData).
const fullPayload = {
  dailyMetrics: metrics,
  dailyLoads: [],
  weeklyLoadByCategory: [],
  sportDistribution: {
    '7':  { run: 0, ride: 0, swim: 0, other: 0, total: 0 },
    '28': { run: 0, ride: 0, swim: 0, other: 0, total: 0 },
    '70': { run: 0, ride: 0, swim: 0, other: 0, total: 0 },
  },
  intensityDistribution: { '7': [], '28': [], '70': [] },
  top: [],
  monotony7d: 0, strain7d: 0, activeDays7d: 0, peakDay7d: null,
  rampRate: { deltaWeekPct: 0, label: 'stable', prevWeekZero: false },
  insights: { status: 'balanced', headline: '', notes: [] },
  noCesActivities7d: 0, noCesActivities28d: 0, historyDays: 100,
} as unknown as ChargeSportPayload

it('clic sur le compteur → page avec les blocs « État de forme du jour » et « Fatigue vs Base de forme »', () => {
  render(<I18nProvider initialLang="fr"><FormeCard payload={fullPayload} /></I18nProvider>)
  fireEvent.click(screen.getByText('-12'))
  expect(screen.getByText('État de forme du jour')).toBeInTheDocument()
  expect(screen.getByText('Fatigue vs Base de forme')).toBeInTheDocument()
})
