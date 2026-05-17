import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityTypesPrefsModal } from '@/components/plan/ActivityTypesPrefsModal'
import type { ActivityType } from '@/types/activity-types'

const types: ActivityType[] = [
  { id: '1', slug: 'sortie_longue', label: 'Sortie longue', defaultIntensity: 2, category: 'run',  isSystem: true },
  { id: '2', slug: 'fractionne',    label: 'Fractionné',    defaultIntensity: 5, category: 'run',  isSystem: true },
  { id: '4', slug: 'tennis',        label: 'Tennis',        defaultIntensity: 2, category: 'other', isSystem: false },
]

describe('<ActivityTypesPrefsModal>', () => {
  it('renders one checkbox row per type', () => {
    render(
      <ActivityTypesPrefsModal
        types={types}
        prefs={[]}
        onSave={() => {}}
        onCreateCustom={async () => types[2]}
        onDeleteCustom={async () => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('shows delete button only for non-system types', () => {
    render(
      <ActivityTypesPrefsModal
        types={types}
        prefs={[]}
        onSave={() => {}}
        onCreateCustom={async () => types[2]}
        onDeleteCustom={async () => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getAllByLabelText(/supprimer/i)).toHaveLength(1)
  })

  it('calls onSave with current draft when "Enregistrer" is clicked', () => {
    const onSave = jest.fn()
    render(
      <ActivityTypesPrefsModal
        types={types}
        prefs={[]}
        onSave={onSave}
        onCreateCustom={async () => types[2]}
        onDeleteCustom={async () => {}}
        onClose={() => {}}
      />
    )
    fireEvent.click(screen.getByText(/enregistrer/i))
    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ activitySlug: 'sortie_longue', isVisible: true }),
        expect.objectContaining({ activitySlug: 'fractionne', isVisible: true }),
        expect.objectContaining({ activitySlug: 'tennis', isVisible: true }),
      ]),
    )
  })

  it('toggles visibility when a checkbox is clicked', () => {
    const onSave = jest.fn()
    render(
      <ActivityTypesPrefsModal
        types={types}
        prefs={[]}
        onSave={onSave}
        onCreateCustom={async () => types[2]}
        onDeleteCustom={async () => {}}
        onClose={() => {}}
      />
    )
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1]) // décoche fractionne
    fireEvent.click(screen.getByText(/enregistrer/i))
    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ activitySlug: 'fractionne', isVisible: false }),
      ]),
    )
  })
})
