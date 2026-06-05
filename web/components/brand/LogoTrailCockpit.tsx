import { cn } from '@/lib/cn'
import {
  VIEWBOX, TRAJ, TRAJ_LEN, SOLID_FRACTION,
  START, END, WAYPOINT_REACHED, WAYPOINT_UPCOMING, TIER,
} from '@/lib/brand/logo-geometry'

// ─────────────────────────────────────────────────────────────────────────
// LogoTrailCockpit — identité de marque, dérivée de la TrajectoryLine.
//
// Concept : une trajectoire qui grimpe, jalonnée d'étapes (atteinte = pleine,
// à venir = anneau creux), avec le reste à parcourir en pointillé, vers un
// drapeau (l'objectif). → mission, progression, direction, endurance.
// 100 % SVG. Géométrie partagée avec le pack d'assets (logo-geometry.ts) →
// le logo écran est identique aux icônes exportées (favicon / PWA / OG).
//
// Variantes : icon · horizontal · stacked
// Tons      : brand (squircle orange + glyphe blanc) · mono (currentColor)
// Palier auto : compact < 40px (épuré), full ≥ 40px (pointillé + étapes).
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
  const squircleFill = brand ? 'var(--primary)' : 'none'
  const squircleStroke = brand ? 'none' : 'currentColor'
  const glyph = brand ? '#FFFFFF' : 'currentColor'
  // Centre de l'étape « à venir » : rempli du fond en brand (laisse voir l'orange),
  // transparent en mono.
  const hole = brand ? 'var(--primary)' : 'none'

  const tier = size < 40 ? 'compact' : 'full'
  const t = tier === 'compact' ? TIER.compact : TIER.full
  const solid = (TRAJ_LEN * SOLID_FRACTION).toFixed(2)
  const tip = END.y - 9
  const fanX = END.x + t.fan

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
      {/* Lunette / instrument */}
      <rect
        x={3} y={3} width={42} height={42} rx={13}
        fill={squircleFill}
        stroke={squircleStroke}
        strokeWidth={brand ? 0 : 2.5}
      />
      {tier === 'full' && (
        <>
          {/* Reste à parcourir — pointillé */}
          <path d={TRAJ} fill="none" stroke={glyph} strokeOpacity={0.5} strokeWidth={t.stroke} strokeLinecap="round" strokeDasharray="0.5 2.6" />
          {/* Accompli — plein */}
          <path d={TRAJ} fill="none" stroke={glyph} strokeWidth={t.stroke} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${solid} ${TRAJ_LEN}`} />
          {/* Départ + étape atteinte (pleines) + étape à venir (anneau creux) */}
          <circle cx={START.x} cy={START.y} r={t.start} fill={glyph} />
          <circle cx={WAYPOINT_REACHED.x} cy={WAYPOINT_REACHED.y} r={2} fill={glyph} />
          <circle cx={WAYPOINT_UPCOMING.x} cy={WAYPOINT_UPCOMING.y} r={2.1} fill={hole} stroke={glyph} strokeWidth={1.5} />
        </>
      )}
      {tier === 'compact' && (
        <>
          {/* Trait plein épaissi, sans pointillé ni étapes (lisible en petit) */}
          <path d={TRAJ} fill="none" stroke={glyph} strokeWidth={t.stroke} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={START.x} cy={START.y} r={t.start} fill={glyph} />
        </>
      )}
      {/* Drapeau d'arrivée — l'objectif */}
      <line x1={END.x} y1={END.y} x2={END.x} y2={tip} stroke={glyph} strokeWidth={t.mast} strokeLinecap="round" />
      <path d={`M${END.x},${tip} L${fanX},${(tip + t.fan * 0.27).toFixed(2)} L${END.x},${(tip + t.fan * 0.54).toFixed(2)} Z`} fill={glyph} />
      <circle cx={END.x} cy={END.y} r={t.node} fill={glyph} />
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
