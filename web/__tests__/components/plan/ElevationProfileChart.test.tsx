import { render, screen } from '@testing-library/react'
import {
  ElevationProfileChart, buildProfileData, exploitableCount,
} from '@/components/plan/ElevationProfileChart'

// jsdom n'implémente pas ResizeObserver, requis par Recharts (ResponsiveContainer).
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
;(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub

const wp = (over: Partial<{ km: number; name: string; altitude: number | null; dPlus: number | null; dMoins: number | null }>) => ({
  km: 0, name: 'P', altitude: null, dPlus: 0, dMoins: 0, ...over,
})

describe('buildProfileData', () => {
  it('mode absolu : trace les altitudes absolues, longueur = nb waypoints', () => {
    const out = buildProfileData([
      wp({ km: 0, name: 'Départ', altitude: 1000, dPlus: 0, dMoins: 0 }),
      wp({ km: 10, name: 'Col', altitude: 1500, dPlus: 600, dMoins: 100 }),
    ])
    expect(out.mode).toBe('absolute')
    expect(out.points).toEqual([
      { km: 0, alt: 1000, name: 'Départ' },
      { km: 10, alt: 1500, name: 'Col' },
    ])
  })

  it('mode relatif : alt = d+ − d−', () => {
    const out = buildProfileData([
      wp({ km: 0, name: 'Départ', altitude: null, dPlus: 0, dMoins: 0 }),
      wp({ km: 5, name: 'R1', altitude: null, dPlus: 300, dMoins: 50 }),
    ])
    expect(out.mode).toBe('relative')
    expect(out.points[1]).toEqual({ km: 5, alt: 250, name: 'R1' })
  })
})

describe('exploitableCount', () => {
  it('compte les points avec alt non null', () => {
    expect(exploitableCount([
      { km: 0, alt: 100, name: 'a' },
      { km: 1, alt: null, name: 'b' },
      { km: 2, alt: 200, name: 'c' },
    ])).toBe(2)
  })
})

describe('ElevationProfileChart', () => {
  it('moins de 2 points exploitables → état vide', () => {
    render(
      <ElevationProfileChart
        waypoints={[wp({ km: 0, name: 'Départ', altitude: null, dPlus: null, dMoins: null })]}
        hoveredIndex={null}
        onHoverIndex={() => {}}
      />,
    )
    expect(screen.getByText('Profil indisponible')).toBeInTheDocument()
  })

  it('≥ 2 points exploitables → rend le graphe (pas l\'état vide)', () => {
    render(
      <ElevationProfileChart
        waypoints={[
          wp({ km: 0, name: 'Départ', altitude: 1000, dPlus: 0, dMoins: 0 }),
          wp({ km: 10, name: 'Col', altitude: 1500, dPlus: 600, dMoins: 100 }),
        ]}
        hoveredIndex={null}
        onHoverIndex={() => {}}
      />,
    )
    expect(screen.queryByText('Profil indisponible')).not.toBeInTheDocument()
  })

  it('mode relatif → affiche le libellé "Altitude relative au départ"', () => {
    render(
      <ElevationProfileChart
        waypoints={[
          wp({ km: 0, name: 'Départ', altitude: null, dPlus: 0, dMoins: 0 }),
          wp({ km: 5, name: 'R1', altitude: null, dPlus: 300, dMoins: 50 }),
        ]}
        hoveredIndex={null}
        onHoverIndex={() => {}}
      />,
    )
    expect(screen.getByText('Altitude relative au départ')).toBeInTheDocument()
  })

  it('mode absolu → n\'affiche PAS le libellé relatif', () => {
    render(
      <ElevationProfileChart
        waypoints={[
          wp({ km: 0, name: 'Départ', altitude: 1000, dPlus: 0, dMoins: 0 }),
          wp({ km: 10, name: 'Col', altitude: 1500, dPlus: 600, dMoins: 100 }),
        ]}
        hoveredIndex={null}
        onHoverIndex={() => {}}
      />,
    )
    expect(screen.queryByText('Altitude relative au départ')).not.toBeInTheDocument()
  })
})
