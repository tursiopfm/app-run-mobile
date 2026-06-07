import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────
// LogoTrailCockpit — identité de marque : montagne enneigée + sentier.
//
// Concept : un sommet à atteindre (montagne blanche) et le sentier qui y mène
// (ruban bleu nuit) sur une pastille orange. → endurance, objectif, trail.
// Le logo écran référence l'icône raster live (public/icons/icon-512.png),
// générée depuis le master `public/brand-source/logo-master.png` par
// `npm run gen:brand-assets` → identique au favicon / PWA / Apple.
//
// Variantes : icon · horizontal · stacked. Le ton « mono » n'a plus d'effet
// (logo couleur unique) ; il reste accepté pour compat d'API.
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

// ── Pastille (icon-only) — logo raster (squircle orange, coins transparents) ──
export function LogoMark({
  size = 40,
  className,
  title = 'Trail Cockpit',
}: {
  tone?: Tone
  size?: number
  className?: string
  title?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/icon-512.png"
      width={size}
      height={size}
      alt={title}
      className={cn('block shrink-0', className)}
    />
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
