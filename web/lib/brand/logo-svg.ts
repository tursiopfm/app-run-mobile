// web/lib/brand/logo-svg.ts
// Builder SVG pur (aucune dépendance React) — source unique de rendu du logo,
// utilisée par le composant preview (BrandGlyph) ET le script d'export (sharp).
import {
  VIEWBOX,
  MOUNTAIN,
  TRAIL,
  VARIANT,
  MASKABLE_SCALE,
  type Tier,
  type Variant,
  type Shape,
} from './logo-geometry'

export type RenderOpts = {
  tier?: Tier
  variant?: Variant
  size?: number
  /** Fond : squircle arrondi (défaut) · bleed plein bord-à-bord · none (transparent). */
  shape?: Shape
  /** PWA maskable : force le bleed + inscrit le glyphe dans la zone sûre. */
  maskable?: boolean
}

export function renderLogoMarkSvg(opts: RenderOpts = {}): string {
  const { tier = 'full', variant = 'orange', size = 512, shape = 'squircle', maskable = false } = opts
  const v = VARIANT[variant]

  const effShape: Shape = maskable ? 'bleed' : shape
  let bg = ''
  if (v.fill && effShape === 'squircle') bg = `<rect x="3" y="3" width="42" height="42" rx="13" fill="${v.fill}"/>`
  else if (v.fill && effShape === 'bleed') bg = `<rect x="0" y="0" width="48" height="48" fill="${v.fill}"/>`

  // Sentier masqué en compact (illisible en petit) et en mono (2 couleurs indistinctes).
  const showTrail = tier === 'full' && v.trail
  const glyph =
    `<path d="${MOUNTAIN}" fill="${v.mountain}"/>` +
    (showTrail ? `<path d="${TRAIL}" fill="${v.trail}"/>` : '')

  let body = glyph
  if (maskable) {
    const s = MASKABLE_SCALE
    const tr = (24 * (1 - s)).toFixed(2)
    body = `<g transform="translate(${tr} ${tr}) scale(${s})">${glyph}</g>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEWBOX}">${bg}${body}</svg>`
}
