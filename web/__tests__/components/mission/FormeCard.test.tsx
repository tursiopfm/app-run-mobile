import { render, screen, fireEvent } from '@testing-library/react'
import { FormeCard } from '@/components/mission/FormeCard'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'

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
