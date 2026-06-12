import { render, screen } from '@testing-library/react'
import { ObjectifCard } from '@/components/mission/ObjectifCard'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

const base = { weekKm: 28, weekDPlus: 1240, ytdKm: 996, todayISO: '2026-06-12', planTarget: null }

// Helper: normalize non-breaking spaces before testing
function normText(el: Element | null): string {
  return (el?.textContent ?? '').replace(/ | /g, ' ')
}

it('objectif annuel défini → barre année avec cible', () => {
  render(
    <I18nProvider initialLang="fr">
      <ObjectifCard {...base} goals={{ weekKm: 50, weekDPlus: 2000, yearKm: 2000 }} />
    </I18nProvider>,
  )
  // At least one element whose text includes "2 000 km"
  const matches = screen.getAllByText((_, el) => normText(el).includes('2 000 km'))
  expect(matches.length).toBeGreaterThanOrEqual(1)
})

it('sans objectif annuel → projection ~2 230', () => {
  render(
    <I18nProvider initialLang="fr">
      <ObjectifCard {...base} goals={{ weekKm: 50 }} />
    </I18nProvider>,
  )
  // At least one element whose text includes "2 230"
  const matches = screen.getAllByText((_, el) => normText(el).includes('2 230'))
  expect(matches.length).toBeGreaterThanOrEqual(1)
})

it('aucune cible → rend null', () => {
  const { container } = render(
    <I18nProvider initialLang="fr">
      <ObjectifCard {...base} ytdKm={0} goals={{}} />
    </I18nProvider>,
  )
  expect(container.firstChild).toBeNull()
})
