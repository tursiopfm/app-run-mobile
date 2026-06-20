import { render } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { ActivityCard } from '@/components/ui/ActivityCard'
import type { ActivityRow } from '@/components/ui/ActivityCard'

function row(p: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: 'a1', sport_type: 'Run', name: 'Sortie en forêt',
    start_time: '2026-06-20T08:00:00Z',
    ces: 75, avg_hr: null, max_hr: null,
    distance_m: 8000, elevation_gain_m: 130, moving_time_sec: 3542,
    computed_intensity: null,
    manual_sport_type: null, manual_intensity: null, manual_workout_type: null,
    manual_distance_m: null, manual_moving_time_sec: null, manual_elevation_gain_m: null,
    ...p,
  }
}

function renderCard(p: Partial<ActivityRow>) {
  return render(
    <I18nProvider initialLang="fr">
      <ActivityCard activity={row(p)} />
    </I18nProvider>,
  )
}

describe('ActivityCard — intensité persistée', () => {
  // Sans FC moyenne, guessIntensity ne peut rien classer (→ « Non mesurée »).
  // La valeur persistée computed_intensity (calculée serveur depuis le stream)
  // doit primer pour afficher la MÊME intensité que la vue détail.
  it('affiche l\'intensité persistée computed_intensity plutôt que l\'estimation', () => {
    const { getByText } = renderCard({ computed_intensity: 'endurance_active' })
    expect(getByText('Tempo')).toBeInTheDocument()
  })

  it('retombe sur « Non mesurée » quand ni computed_intensity ni FC ne sont dispo', () => {
    const { getByText } = renderCard({ computed_intensity: null })
    expect(getByText('Non mesurée')).toBeInTheDocument()
  })
})
