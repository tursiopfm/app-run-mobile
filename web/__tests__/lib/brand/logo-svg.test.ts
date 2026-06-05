import { renderLogoMarkSvg } from '@/lib/brand/logo-svg'

describe('renderLogoMarkSvg', () => {
  it('émet un SVG valide en viewBox 48', () => {
    const svg = renderLogoMarkSvg()
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox="0 0 48 48"')
  })

  it('variante orange = squircle #FF7900 + glyphe blanc', () => {
    const svg = renderLogoMarkSvg({ variant: 'orange' })
    expect(svg).toContain('rx="13"')
    expect(svg).toContain('fill="#FF7900"')
    expect(svg).toContain('stroke="#FFFFFF"')
  })

  it('variante deep = fond #0B0F14 + glyphe orange', () => {
    const svg = renderLogoMarkSvg({ variant: 'deep' })
    expect(svg).toContain('fill="#0B0F14"')
    expect(svg).toContain('stroke="#FF7900"')
  })

  it('variante mono-white = aucun fond (pas de rect)', () => {
    const svg = renderLogoMarkSvg({ variant: 'mono-white' })
    expect(svg).not.toContain('<rect')
    expect(svg).toContain('stroke="#FFFFFF"')
  })

  it('compact = ni pointillé ni étape à venir', () => {
    const svg = renderLogoMarkSvg({ tier: 'compact' })
    expect(svg).not.toContain('stroke-dasharray')
    // l'anneau « étape à venir » est le seul élément avec stroke-width="1.5"
    expect(svg).not.toContain('stroke-width="1.5"')
  })

  it('full = pointillé + étape à venir présents', () => {
    const svg = renderLogoMarkSvg({ tier: 'full' })
    expect(svg).toContain('stroke-dasharray')
    expect(svg).toContain('stroke-width="1.5"')
  })

  it('maskable = fond bord-à-bord + glyphe scalé dans la zone sûre', () => {
    const svg = renderLogoMarkSvg({ maskable: true })
    expect(svg).toContain('width="48"')
    expect(svg).toContain('scale(0.62)')
  })
})
