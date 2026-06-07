import { cn } from '@/lib/cn'
import { VIEWBOX, MOUNTAIN, TRAIL } from '@/lib/brand/logo-geometry'

// ─────────────────────────────────────────────────────────────────────────
// LogoTrailCockpit — identité de marque : montagne enneigée + sentier.
//
// Concept : un sommet à atteindre (montagne blanche) et le sentier qui y mène
// (ruban bleu nuit qui serpente) sur une pastille orange. → endurance, objectif, trail.
// 100 % SVG. Géométrie partagée avec le pack d'assets (logo-geometry.ts) →
// le logo écran est identique aux icônes exportées (favicon / PWA / OG).
//
// Variantes : icon · horizontal · stacked
// Tons      : brand (squircle orange + montagne blanche + sentier navy) · mono (currentColor)
// Petit (< 40px) ou mono : montagne seule (sentier masqué).
//
// Composant serveur (aucun hook).
// ─────────────────────────────────────────────────────────────────────────

type Variant = 'icon' | 'horizontal' | 'stacked'
type Tone = 'brand' | 'mono'

type Props = {
  variant?: Variant
  tone?: Tone
  /** Taille de la pastille (px). Le wordmark s'échelonne dessus. */
  size?: number
  className?: string
  title?: string
}

// ── Pastille (icon-only), pure SVG, viewBox 48 ──────────────────────────
export function LogoMark({
  tone = 'brand',
  size = 40,
  className,
  title = 'Trail Cockpit',
}: {
  tone?: Tone
  size?: number
  className?: string
  title?: string
}) {
  const brand = tone === 'brand'
  const mountain = brand ? '#FFFFFF' : 'currentColor'
  const showTrail = brand && size >= 40 // petit : montagne seule

  return (
    <svg
      viewBox={VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn('block shrink-0', className)}
    >
      <title>{title}</title>
      {brand && <rect x={3} y={3} width={42} height={42} rx={13} fill="var(--primary)" />}
      <path d={MOUNTAIN} fill={mountain} />
      {showTrail && <path d={TRAIL} fill="var(--brand-trail, #17284A)" />}
    </svg>
  )
}

// ── Wordmark (texte), couleurs theme-aware ──────────────────────────────
function Wordmark({ fontSize, className }: { fontSize: number; className?: string }) {
  return (
    <span
      className={cn('font-display font-bold uppercase leading-none whitespace-nowrap', className)}
      style={{ fontSize, letterSpacing: '0.12em' }}
    >
      {/* « Trail » = orange de marque (identique dark/light) ;
          « Cockpit » = currentColor → suit la couleur du contexte/thème. */}
      <span style={{ color: 'var(--primary)' }}>Trail</span>
      <span>&nbsp;Cockpit</span>
    </span>
  )
}

// ── Composant principal ─────────────────────────────────────────────────
export function LogoTrailCockpit({
  variant = 'horizontal',
  tone = 'brand',
  size = 40,
  className,
  title = 'Trail Cockpit',
}: Props) {
  if (variant === 'icon') {
    return <LogoMark tone={tone} size={size} className={className} title={title} />
  }

  if (variant === 'stacked') {
    return (
      <div className={cn('inline-flex flex-col items-center', className)} style={{ gap: size * 0.16 }}>
        <LogoMark tone={tone} size={size} title={title} />
        <Wordmark fontSize={size * 0.3} />
      </div>
    )
  }

  // horizontal
  return (
    <div className={cn('inline-flex items-center', className)} style={{ gap: size * 0.28 }}>
      <LogoMark tone={tone} size={size} title={title} />
      <Wordmark fontSize={size * 0.46} />
    </div>
  )
}
