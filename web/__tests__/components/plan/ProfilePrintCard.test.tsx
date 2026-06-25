import { render, screen } from '@testing-library/react'
import { ProfilePrintCard } from '@/components/plan/ProfilePrintCard'
import { DEFAULT_PROFILE_INFO } from '@/lib/plan/print-profile-info'
import type { Race, RaceWaypoint } from '@/types/plan'

const race = {
  id: 'r1', name: 'Course Test', date: '2026-09-01', distance: 20, elevation: 1200,
  type: 'trail', startTime: '06:00', targetDurationMin: 180,
} as unknown as Race

const wps = [
  { id: 'w0', raceId: 'r1', km: 0, name: 'Départ', altitude: 1000, dPlus: 0, dMoins: 0, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'start', targetOverrideSec: null },
  { id: 'w1', raceId: 'r1', km: 10, name: 'Refuge', altitude: 1800, dPlus: 800, dMoins: 0, supplies: ['liquid', 'solid'], cutoffRaw: '02:30', cutoffKind: 'clock', type: 'ravito', targetOverrideSec: null },
  { id: 'w2', raceId: 'r1', km: 20, name: 'Arrivée', altitude: 1000, dPlus: 0, dMoins: 800, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'end', targetOverrideSec: null },
] as unknown as RaceWaypoint[]

const dense = { d: [0, 5, 10, 15, 20], e: [1000, 1400, 1800, 1400, 1000] }

describe('ProfilePrintCard', () => {
  it('affiche le nom de course et les waypoints', () => {
    render(<ProfilePrintCard race={race} waypoints={wps} denseProfile={dense} info={DEFAULT_PROFILE_INFO} />)
    expect(screen.getByText('Course Test')).toBeInTheDocument()
    expect(screen.getByText('Refuge')).toBeInTheDocument()
  })

  it('affiche la ligne objectif quand info.objectif est vrai, et la masque sinon', () => {
    const { rerender } = render(<ProfilePrintCard race={race} waypoints={wps} denseProfile={dense} info={DEFAULT_PROFILE_INFO} />)
    expect(screen.getAllByTestId('obj').length).toBeGreaterThan(0)
    rerender(<ProfilePrintCard race={race} waypoints={wps} denseProfile={dense} info={{ ...DEFAULT_PROFILE_INFO, objectif: false }} />)
    expect(screen.queryAllByTestId('obj')).toHaveLength(0)
  })

  it('masque les barrières quand info.barriers est faux', () => {
    const { rerender } = render(<ProfilePrintCard race={race} waypoints={wps} denseProfile={dense} info={DEFAULT_PROFILE_INFO} />)
    expect(screen.getAllByTestId('barrier').length).toBeGreaterThan(0)
    rerender(<ProfilePrintCard race={race} waypoints={wps} denseProfile={dense} info={{ ...DEFAULT_PROFILE_INFO, barriers: false }} />)
    expect(screen.queryAllByTestId('barrier')).toHaveLength(0)
  })
})
