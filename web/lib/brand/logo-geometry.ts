// web/lib/brand/logo-geometry.ts
// Géométrie du glyphe de marque — TrajectoryLine miniature (viewBox 0 0 48 48).
// Source de vérité partagée par le builder SVG (écran + export PNG). Aucune logique.

export const VIEWBOX = '0 0 48 48'
export const TRAJ = 'M10,37 C 14,36 15,31 19,30.5 C 23,30 24,33 27.5,31.5 C 31,30 32,22 35,15'
// Longueur du tracé mesurée via SVGPathElement.getTotalLength() — sert aux dasharray
// en unités absolues (rendu déterministe navigateur + sharp/librsvg, sans pathLength).
export const TRAJ_LEN = 38.58
export const SOLID_FRACTION = 0.6 // part « accomplie » (plein) ; le reste est en pointillé

export type Tier = 'full' | 'compact'
export type Variant = 'orange' | 'deep' | 'mono-white' | 'mono-black'
export type Shape = 'squircle' | 'bleed' | 'none'

export const START = { x: 10, y: 37 } as const
export const END = { x: 35, y: 15 } as const // base du drapeau
export const WAYPOINT_REACHED = { x: 19, y: 30.5 } as const
export const WAYPOINT_UPCOMING = { x: 27.5, y: 31.5 } as const

export const TIER: Record<Tier, { stroke: number; start: number; node: number; mast: number; fan: number }> = {
  full: { stroke: 3, start: 2.2, node: 2.1, mast: 1.8, fan: 6.4 },
  compact: { stroke: 3.8, start: 2.7, node: 2.1, mast: 2.4, fan: 7.2 },
}

export const VARIANT: Record<Variant, { fill: string | null; glyph: string; surface: string }> = {
  orange: { fill: '#FF7900', glyph: '#FFFFFF', surface: '#FF7900' },
  deep: { fill: '#0B0F14', glyph: '#FF7900', surface: '#0B0F14' },
  'mono-white': { fill: null, glyph: '#FFFFFF', surface: 'none' },
  'mono-black': { fill: null, glyph: '#13201D', surface: 'none' },
}

export const MASKABLE_SCALE = 0.62 // glyphe inscrit dans la zone sûre Android (~80%)
