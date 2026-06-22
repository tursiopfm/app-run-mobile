import { render, screen } from '@testing-library/react'
import {
  ElevationProfileChart, interpolateAlt, buildMarkers, elevationDomain,
} from '@/components/plan/ElevationProfileChart'

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
;(global as any).ResizeObserver = ResizeObserverStub

const wp = (over: Partial<{ km: number; name: string; altitude: number | null; dPlus: number | null; dMoins: number | null }>) => ({
  km: 0, name: 'P', altitude: null, dPlus: 0, dMoins: 0, ...over,
})

describe('interpolateAlt', () => {
  it('interpole linéairement entre deux points', () => {
    expect(interpolateAlt([0, 10], [1000, 2000], 5)).toBe(1500)
  })
  it('borne aux extrémités', () => {
    expect(interpolateAlt([0, 10], [1000, 2000], -1)).toBe(1000)
    expect(interpolateAlt([0, 10], [1000, 2000], 99)).toBe(2000)
  })
})

describe('buildMarkers', () => {
  it('place chaque waypoint sur la courbe à son km', () => {
    const markers = buildMarkers(
      [{ km: 0, name: 'Départ' }, { km: 5, name: 'Col' }],
      { d: [0, 10], e: [1000, 2000] },
    )
    expect(markers).toEqual([
      { km: 0, alt: 1000, wpIndex: 0, name: 'Départ' },
      { km: 5, alt: 1500, wpIndex: 1, name: 'Col' },
    ])
  })
})

describe('elevationDomain', () => {
  it('laisse une marge au-dessus du sommet (la crête ne touche pas le bord)', () => {
    const [lo, hi] = elevationDomain([600, 1800, 2300, 900])
    expect(hi).toBeGreaterThan(2300)
    expect(lo).toBeLessThanOrEqual(600)
    expect(lo).toBeGreaterThanOrEqual(0)
  })
  it('arrondit aux 100 m', () => {
    const [lo, hi] = elevationDomain([612, 2287])
    expect(lo % 100).toBe(0)
    expect(hi % 100).toBe(0)
  })
  it('ne descend jamais sous 0', () => {
    const [lo] = elevationDomain([5, 30])
    expect(lo).toBe(0)
  })
  it('tableau vide → domaine de repli', () => {
    expect(elevationDomain([])).toEqual([0, 100])
  })
})

describe('ElevationProfileChart — mode dense', () => {
  it('denseProfile fourni → pas de libellé « relatif », rend le graphe', () => {
    render(
      <ElevationProfileChart
        waypoints={[wp({ km: 0, name: 'Départ' }), wp({ km: 5, name: 'Col' })]}
        denseProfile={{ d: [0, 2.5, 5], e: [1000, 1400, 1200] }}
        hoveredIndex={null}
        onHoverIndex={() => {}}
      />,
    )
    expect(screen.queryByText('Altitude relative au départ')).not.toBeInTheDocument()
    expect(screen.queryByText('Profil indisponible')).not.toBeInTheDocument()
  })

  it('sans denseProfile : comportement Option A inchangé (escalier relatif)', () => {
    render(
      <ElevationProfileChart
        waypoints={[
          wp({ km: 0, name: 'Départ', altitude: null, dPlus: 0, dMoins: 0 }),
          wp({ km: 5, name: 'Col', altitude: null, dPlus: 300, dMoins: 50 }),
        ]}
        hoveredIndex={null}
        onHoverIndex={() => {}}
      />,
    )
    expect(screen.getByText('Altitude relative au départ')).toBeInTheDocument()
  })
})
