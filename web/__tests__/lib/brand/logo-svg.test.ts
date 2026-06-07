import { renderLogoMarkSvg } from '@/lib/brand/logo-svg'
import { MOUNTAIN, TRAIL } from '@/lib/brand/logo-geometry'

describe('renderLogoMarkSvg', () => {
  it('émet un SVG valide en viewBox 48', () => {
    const svg = renderLogoMarkSvg()
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox="0 0 48 48"')
  })

  it('variante orange = squircle #FF7900 + montagne blanche + sentier navy', () => {
    const svg = renderLogoMarkSvg({ variant: 'orange' })
    expect(svg).toContain('rx="13"')
    expect(svg).toContain('fill="#FF7900"')
    expect(svg).toContain(`<path d="${MOUNTAIN}" fill="#FFFFFF"/>`)
    expect(svg).toContain(`<path d="${TRAIL}" fill="#17284A"/>`)
  })

  it('variante deep = fond #0B0F14 + montagne claire + sentier orange', () => {
    const svg = renderLogoMarkSvg({ variant: 'deep' })
    expect(svg).toContain('fill="#0B0F14"')
    expect(svg).toContain('fill="#EAF0F6"')
    expect(svg).toContain(`<path d="${TRAIL}" fill="#FF7900"/>`)
  })

  it('mono-white = aucun fond + montagne blanche + pas de sentier', () => {
    const svg = renderLogoMarkSvg({ variant: 'mono-white' })
    expect(svg).not.toContain('<rect')
    expect(svg).toContain(`<path d="${MOUNTAIN}" fill="#FFFFFF"/>`)
    expect(svg).not.toContain(TRAIL)
  })

  it('compact = montagne seule (pas de sentier)', () => {
    const svg = renderLogoMarkSvg({ tier: 'compact' })
    expect(svg).toContain(MOUNTAIN)
    expect(svg).not.toContain(TRAIL)
  })

  it('full orange = montagne + sentier', () => {
    const svg = renderLogoMarkSvg({ tier: 'full', variant: 'orange' })
    expect(svg).toContain(MOUNTAIN)
    expect(svg).toContain(TRAIL)
  })

  it('maskable = fond bord-à-bord + glyphe scalé dans la zone sûre', () => {
    const svg = renderLogoMarkSvg({ maskable: true })
    expect(svg).toContain('width="48"')
    expect(svg).toContain('scale(0.62)')
  })
})
