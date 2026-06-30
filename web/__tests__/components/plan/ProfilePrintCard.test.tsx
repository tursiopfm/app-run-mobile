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

  it('cas dense : affiche TOUTE la cotation et étale objectif + cotation sur 2 niveaux', () => {
    // grappe de points serrés (≈0,5 km) → les libellés se chevaucheraient sur un seul rang.
    const denseWps = [
      { id: 'd0', raceId: 'r1', km: 0, name: 'Départ', altitude: 1000, dPlus: 0, dMoins: 0, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'start', targetOverrideSec: null },
      { id: 'd1', raceId: 'r1', km: 4, name: 'P1', altitude: 1500, dPlus: 500, dMoins: 0, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'ravito', targetOverrideSec: null },
      { id: 'd2', raceId: 'r1', km: 8, name: 'P2', altitude: 2000, dPlus: 500, dMoins: 0, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'ravito', targetOverrideSec: null },
      { id: 'd3', raceId: 'r1', km: 8.5, name: 'P3', altitude: 1950, dPlus: 20, dMoins: 70, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'ravito', targetOverrideSec: null },
      { id: 'd4', raceId: 'r1', km: 9, name: 'P4', altitude: 1900, dPlus: 10, dMoins: 60, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'ravito', targetOverrideSec: null },
      { id: 'd5', raceId: 'r1', km: 9.5, name: 'P5', altitude: 1850, dPlus: 10, dMoins: 60, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'ravito', targetOverrideSec: null },
      { id: 'd6', raceId: 'r1', km: 10, name: 'P6', altitude: 1800, dPlus: 0, dMoins: 60, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'ravito', targetOverrideSec: null },
      { id: 'd7', raceId: 'r1', km: 20, name: 'Arrivée', altitude: 1000, dPlus: 0, dMoins: 800, supplies: [], cutoffRaw: null, cutoffKind: null, type: 'end', targetOverrideSec: null },
    ] as unknown as RaceWaypoint[]
    const denseTrace = { d: [0, 4, 8, 9, 10, 20], e: [1000, 1500, 2000, 1900, 1800, 1000] }
    const { container } = render(<ProfilePrintCard race={race} waypoints={denseWps} denseProfile={denseTrace} info={DEFAULT_PROFILE_INFO} />)

    // #2 : un ▲<D+> par tronçon, AUCUN masqué (n-1 tronçons).
    const texts = Array.from(container.querySelectorAll('text'))
    const dpTexts = texts.filter((t) => /^▲\d/.test(t.textContent || ''))
    expect(dpTexts).toHaveLength(denseWps.length - 1)
    // #2/#3 : cotation étalée sur 2 rangs (2 valeurs de y distinctes).
    expect(new Set(dpTexts.map((t) => t.getAttribute('y'))).size).toBe(2)

    // #3 : heures objectif étalées sur 2 niveaux.
    const objYs = new Set(screen.getAllByTestId('obj').map((o) => o.getAttribute('y')))
    expect(objYs.size).toBe(2)
  })
})
