import { render } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { ActivityDetailClient, type ActivityDetail } from '@/app/(public)/activities/[id]/ActivityDetailClient'

jest.mock('next/dynamic', () => ({ __esModule: true, default: () => () => null }))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
}))
jest.mock('@/components/ui/ActivityMap', () => ({
  ActivityMapPlaceholder: () => null,
  DynamicActivityMap: () => null,
}))

const ACTIVITY: ActivityDetail = {
  id: 'abc', sport_type: 'Run', manual_sport_type: null, name: 'Sortie',
  start_time: '2026-06-01T07:00:00Z', ces: 90, manual_intensity: null,
  manual_workout_type: null, distance_m: 10000, manual_distance_m: null,
  elevation_gain_m: 200, manual_elevation_gain_m: null, moving_time_sec: 3000,
  manual_moving_time_sec: null, duration_sec: 3100, avg_hr: null, max_hr: null,
  calories: 500, raw_payload: {}, provider: 'manual', provider_activity_id: null,
}

const PROFILE = {
  max_hr: 190, resting_hr: 50, aerobic_threshold_hr: null, threshold_hr: 170,
  birth_year: 1985, hr_zone_method: 'pct_max', hr_zones_custom: null,
}

function renderClient(readOnly: boolean) {
  return render(
    <I18nProvider initialLang="fr">
      <ActivityDetailClient
        activity={ACTIVITY}
        splits={null}
        laps={null}
        athleteProfile={PROFILE}
        hrStream={null}
        readOnly={readOnly}
      />
    </I18nProvider>
  )
}

describe('ActivityDetailClient readOnly', () => {
  it('masque le bouton Modifier en lecture seule', () => {
    const { queryByTestId } = renderClient(true)
    expect(queryByTestId('edit-activity-btn')).toBeNull()
  })

  it('affiche le bouton Modifier pour le propriétaire', () => {
    const { queryByTestId } = renderClient(false)
    expect(queryByTestId('edit-activity-btn')).not.toBeNull()
  })
})
