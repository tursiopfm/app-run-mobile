import { render, screen } from '@testing-library/react'
import { WaypointsTable } from '@/components/plan/WaypointsTable'
import type { RaceWaypoint } from '@/types/plan'

type Draft = Omit<RaceWaypoint, 'id' | 'raceId'>
const wp = (over: Partial<Draft>): Draft => ({
  orderIndex: 0, name: 'P', km: 0, kmInter: null, dPlus: 0, dMoins: 0,
  altitude: null, cutoffRaw: null, cutoffKind: null, type: 'ravito',
  supplies: [], targetOverrideSec: null, ...over,
})

describe('WaypointsTable — colonne Alt', () => {
  it('affiche l\'en-tête Alt et l\'altitude absolue (mode absolu)', () => {
    render(
      <WaypointsTable
        waypoints={[
          wp({ orderIndex: 0, name: 'Départ', km: 0, altitude: 1000, dPlus: 0, dMoins: 0, type: 'depart' }),
          wp({ orderIndex: 1, name: 'Col', km: 10, altitude: 1850, dPlus: 900, dMoins: 50, type: 'arrivee' }),
        ]}
        onChange={() => {}}
        readOnly
      />,
    )
    expect(screen.getByText('Alt')).toBeInTheDocument()
    expect(screen.getByText('1850')).toBeInTheDocument()
  })

  it('mode relatif (départ sans altitude) → valeur signée', () => {
    render(
      <WaypointsTable
        waypoints={[
          wp({ orderIndex: 0, name: 'Départ', km: 0, altitude: null, dPlus: 0, dMoins: 0, type: 'depart' }),
          wp({ orderIndex: 1, name: 'Col', km: 10, altitude: null, dPlus: 900, dMoins: 50, type: 'arrivee' }),
        ]}
        onChange={() => {}}
        readOnly
      />,
    )
    expect(screen.getByText('+850')).toBeInTheDocument()
  })
})
