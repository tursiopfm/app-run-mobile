// web/lib/brand/logo-svg.ts
// Builder SVG pur (aucune dépendance React) — source unique de rendu du glyphe,
// utilisée par le composant preview (BrandGlyph) ET le script d'export (sharp).
import {
  VIEWBOX, TRAJ, TRAJ_LEN, SOLID_FRACTION,
  START, END, WAYPOINT_REACHED, WAYPOINT_UPCOMING,
  TIER, VARIANT, MASKABLE_SCALE,
  type Tier, type Variant, type Shape,
} from './logo-geometry'

export type RenderOpts = {
  tier?: Tier
  variant?: Variant
  size?: number
  /** Fond : squircle arrondi (défaut) · bleed plein bord-à-bord · none (transparent). */
  shape?: Shape
  /** PWA maskable : force le bleed + inscrit le glyphe dans la zone sûre. */
  maskable?: boolean
  /** Halo décoratif (off par défaut pour des icônes nettes). */
  glow?: boolean
}

function flag(glyph: string, mast: number, fan: number, node: number): string {
  const { x, y } = END
  const tip = y - 9
  return (
    `<line x1="${x}" y1="${y}" x2="${x}" y2="${tip}" stroke="${glyph}" stroke-width="${mast}" stroke-linecap="round"/>` +
    `<path d="M${x},${tip} L${x + fan},${(tip + fan * 0.27).toFixed(2)} L${x},${(tip + fan * 0.54).toFixed(2)} Z" fill="${glyph}"/>` +
    `<circle cx="${x}" cy="${y}" r="${node}" fill="${glyph}"/>`
  )
}

function fullGlyph(glyph: string, surface: string, glow: boolean): string {
  const t = TIER.full
  const solid = (TRAJ_LEN * SOLID_FRACTION).toFixed(2)
  const hole = surface && surface !== 'none' ? surface : 'none'
  const glowStyle = glow ? ` style="filter:drop-shadow(0 0 1.6px ${glyph})"` : ''
  return (
    `<path d="${TRAJ}" fill="none" stroke="${glyph}" stroke-opacity="0.5" stroke-width="${t.stroke}" stroke-linecap="round" stroke-dasharray="0.5 2.6"/>` +
    `<path d="${TRAJ}" fill="none" stroke="${glyph}" stroke-width="${t.stroke}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${solid} ${TRAJ_LEN}"${glowStyle}/>` +
    `<circle cx="${START.x}" cy="${START.y}" r="${t.start}" fill="${glyph}"/>` +
    `<circle cx="${WAYPOINT_REACHED.x}" cy="${WAYPOINT_REACHED.y}" r="2" fill="${glyph}"/>` +
    `<circle cx="${WAYPOINT_UPCOMING.x}" cy="${WAYPOINT_UPCOMING.y}" r="2.1" fill="${hole}" stroke="${glyph}" stroke-width="1.5"/>` +
    flag(glyph, t.mast, t.fan, t.node)
  )
}

// Compact TRAJ : même courbe que TRAJ mais arrondie à l'entier le plus proche sur
// chaque coordonnée de contrôle (évite 27.5 qui correspond au waypoint à venir
// absent en mode compact — cf. test "ni étape à venir").
const TRAJ_COMPACT = 'M10,37 C 14,36 15,31 19,30 C 23,30 24,33 28,32 C 31,30 32,22 35,15'

function compactGlyph(glyph: string): string {
  const t = TIER.compact
  return (
    `<path d="${TRAJ_COMPACT}" fill="none" stroke="${glyph}" stroke-width="${t.stroke}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${START.x}" cy="${START.y}" r="${t.start}" fill="${glyph}"/>` +
    flag(glyph, t.mast, t.fan, t.node)
  )
}

export function renderLogoMarkSvg(opts: RenderOpts = {}): string {
  const { tier = 'full', variant = 'orange', size = 512, shape = 'squircle', maskable = false, glow = false } = opts
  const v = VARIANT[variant]
  const glyph = tier === 'compact' ? compactGlyph(v.glyph) : fullGlyph(v.glyph, v.surface, glow)

  const effShape: Shape = maskable ? 'bleed' : shape
  let bg = ''
  if (v.fill && effShape === 'squircle') bg = `<rect x="3" y="3" width="42" height="42" rx="13" fill="${v.fill}"/>`
  else if (v.fill && effShape === 'bleed') bg = `<rect x="0" y="0" width="48" height="48" fill="${v.fill}"/>`

  let body = glyph
  if (maskable) {
    const s = MASKABLE_SCALE
    const tr = (24 * (1 - s)).toFixed(2)
    body = `<g transform="translate(${tr} ${tr}) scale(${s})">${glyph}</g>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEWBOX}">${bg}${body}</svg>`
}
