import { render, screen } from '@testing-library/react'
import { MissionActivities } from '@/components/mission/MissionActivities'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { ActivityRow } from '@/components/ui/ActivityCard'

function act(p: Partial<ActivityRow>): ActivityRow {
  return {
    id: 'a1', name: 'Sortie', sport_type: 'TrailRun',
    start_time: new Date().toISOString(),
    ces: 80, avg_hr: null, distance_m: 14200, elevation_gain_m: 620, moving_time_sec: 5880,
    manual_intensity: null, manual_sport_type: null, manual_workout_type: null,
    manual_distance_m: null, manual_elevation_gain_m: null, manual_moving_time_sec: null,
    ...p,
  } as ActivityRow
}

it('héros dernière sortie + cumul mois, sans CES affiché', () => {
  render(
    <I18nProvider initialLang="fr">
      <MissionActivities activities={[act({ id: '1', name: 'Trail du Salève' }), act({ id: '2', name: 'Footing' })]} />
    </I18nProvider>,
  )
  expect(screen.getByText('Trail du Salève')).toBeInTheDocument()
  expect(screen.getByText('Ce mois-ci')).toBeInTheDocument()
  expect(screen.queryByText(/CES/)).not.toBeInTheDocument()
})
