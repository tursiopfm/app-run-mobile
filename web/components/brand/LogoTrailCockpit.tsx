import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────
// LogoTrailCockpit — identité de marque, dérivée de la TrajectoryLine.
//
// Concept : une trajectoire ascendante qui vise une cible (l'objectif),
// inscrite dans une « lunette » arrondie (l'instrument / le cockpit).
// → mission, progression, direction, cockpit, endurance.
// Pas de montagne, pas de coureur, 100 % SVG (favicon / PWA / splash OK).
//
// Variantes : icon · horizontal · stacked
// Tons      : brand (squircle orange + glyphe blanc) · mono (currentColor)
//
// Composant serveur (aucun hook). Ne remplace PAS le logo live — preview.
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
  const squircleFill = brand ? 'var(--primary)' : 'none'
  const squircleStroke = brand ? 'none' : 'currentColor'
  const glyph = brand ? '#FFFFFF' : 'currentColor'
  // Centre du nœud de départ : « creux » en brand (laisse voir l'orange).
  const startFill = brand ? 'var(--primary)' : 'none'

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn('block shrink-0', className)}
    >
      <title>{title}</title>
      {/* Lunette / instrument */}
      <rect
        x={3} y={3} width={42} height={42} rx={13}
        fill={squircleFill}
        stroke={squircleStroke}
        strokeWidth={brand ? 0 : 2.5}
      />
      {/* Trajectoire ascendante */}
      <path
        d="M12 34 C 18 32 21 25 27 22 C 31 20 32 19 35.5 14.5"
        fill="none"
        stroke={glyph}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Départ — nœud creux */}
      <circle cx={12} cy={34} r={2.4} fill={startFill} stroke={glyph} strokeWidth={2} />
      {/* Cible — anneau (visée / direction) + disque (l'objectif) */}
      <circle cx={35.5} cy={14.5} r={5} fill="none" stroke={glyph} strokeWidth={2} opacity={0.55} />
      <circle cx={35.5} cy={14.5} r={2.9} fill={glyph} />
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
