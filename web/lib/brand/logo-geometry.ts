// web/lib/brand/logo-geometry.ts
// Géométrie du logo de marque — montagne enneigée + sentier (viewBox 0 0 48 48).
// Source de vérité partagée par le builder SVG (écran + export PNG) ET le composant
// React live (LogoTrailCockpit.tsx). Aucune logique de rendu ici.

export const VIEWBOX = '0 0 48 48'

export type Tier = 'full' | 'compact'
export type Variant = 'orange' | 'deep' | 'mono-white' | 'mono-black'
export type Shape = 'squircle' | 'bleed' | 'none'

// Montagne (fill) — pic principal pointu (g.) + pic secondaire bas (dr.), stries « neige ».
export const MOUNTAIN =
  'M3,42 L9,31 L11,33.5 L14,26 L16,28.5 L18.5,9 L21.5,17 L23,14 L25.5,21 L29,16 L31,18.5 L33,15 L35.5,19 L45,42 Z'

// ── Sentier : ruban à largeur variable le long d'une médiane en S (route en perspective).
type Pt = { x: number; y: number }
const TRAIL_CTRL: readonly [Pt, Pt, Pt, Pt] = [
  { x: 23, y: 47 },
  { x: 30, y: 40 },
  { x: 17, y: 31 },
  { x: 24, y: 25.5 },
]
const TRAIL_W0 = 17 // largeur en bas (bouche de route)
const TRAIL_W1 = 1.0 // largeur en haut (pointe)
const TRAIL_TAPER = 2.2 // > 1 : corps slim, évasement concentré en bas
const TRAIL_SAMPLES = 56

function cubic(p: readonly Pt[], t: number): Pt {
  const u = 1 - t
  const a = u * u * u,
    b = 3 * u * u * t,
    c = 3 * u * t * t,
    d = t * t * t
  return {
    x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
    y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y,
  }
}
function cubicTangent(p: readonly Pt[], t: number): Pt {
  const u = 1 - t
  const x =
    3 * u * u * (p[1].x - p[0].x) + 6 * u * t * (p[2].x - p[1].x) + 3 * t * t * (p[3].x - p[2].x)
  const y =
    3 * u * u * (p[1].y - p[0].y) + 6 * u * t * (p[2].y - p[1].y) + 3 * t * t * (p[3].y - p[2].y)
  const m = Math.hypot(x, y) || 1
  return { x: x / m, y: y / m }
}
function buildTrail(): string {
  const left: Pt[] = [],
    right: Pt[] = []
  for (let i = 0; i <= TRAIL_SAMPLES; i++) {
    const t = i / TRAIL_SAMPLES
    const p = cubic(TRAIL_CTRL, t)
    const tan = cubicTangent(TRAIL_CTRL, t)
    const nx = -tan.y,
      ny = tan.x // normale
    const hw = (TRAIL_W1 + (TRAIL_W0 - TRAIL_W1) * Math.pow(1 - t, TRAIL_TAPER)) / 2
    left.push({ x: p.x + nx * hw, y: p.y + ny * hw })
    right.push({ x: p.x - nx * hw, y: p.y - ny * hw })
  }
  const pts = [...left, ...right.reverse()]
  return 'M' + pts.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' L') + ' Z'
}

export const TRAIL = buildTrail()

export const VARIANT: Record<
  Variant,
  { fill: string | null; mountain: string; trail: string | null }
> = {
  orange: { fill: '#FF7900', mountain: '#FFFFFF', trail: '#17284A' },
  deep: { fill: '#0B0F14', mountain: '#EAF0F6', trail: '#FF7900' },
  'mono-white': { fill: null, mountain: '#FFFFFF', trail: null },
  'mono-black': { fill: null, mountain: '#13201D', trail: null },
}

export const MASKABLE_SCALE = 0.62 // glyphe inscrit dans la zone sûre Android (~80%)
