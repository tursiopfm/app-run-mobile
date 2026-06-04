import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────
// TrajectoryLine — élément graphique central de la marque Trail Cockpit.
// La ligne de trajectoire symbolise la progression, le parcours, la mission.
//
// Caractéristiques :
//   • SVG responsive (remplit son conteneur, trait net via vector-effect)
//   • orientation horizontale ou verticale
//   • mode animé (la ligne se dessine — SMIL, fonctionne sans JS) ou statique
//   • point d'arrivée optionnel (la cible de la mission)
//
// Conçu comme composant serveur (aucun hook) → utilisable partout, y compris
// dans des Server Components.
// ─────────────────────────────────────────────────────────────────────────

type Orientation = 'horizontal' | 'vertical'

type Props = {
  orientation?: Orientation
  /** true = la ligne se dessine à l'apparition. */
  animated?: boolean
  /** Couleur du trait (défaut : couleur de marque). */
  color?: string
  /** Épaisseur du trait en px (constante quelle que soit l'échelle). */
  strokeWidth?: number
  /** Affiche le point d'arrivée (la cible). */
  endpoint?: boolean
  /** Affiche le « rail » fantôme sous la trajectoire. */
  track?: boolean
  /** Halo lumineux autour du trait. */
  glow?: boolean
  /** Durée du tracé animé (s). */
  duration?: number
  className?: string
}

const SHAPES: Record<Orientation, { viewBox: string; d: string; end: [number, number] }> = {
  // Monte de gauche-bas vers droite-haut.
  horizontal: { viewBox: '0 0 100 40', d: 'M1,37 C 30,35 46,11 99,4', end: [99, 4] },
  // Monte de bas vers haut (timeline de mission).
  vertical:   { viewBox: '0 0 40 100', d: 'M4,99 C 6,70 31,55 36,1', end: [36, 1] },
}

export function TrajectoryLine({
  orientation = 'horizontal',
  animated = false,
  color = 'var(--primary)',
  strokeWidth = 2.5,
  endpoint = true,
  track = true,
  glow = true,
  duration = 1.6,
  className,
}: Props) {
  const shape = SHAPES[orientation]
  const [ex, ey] = shape.end
  const glowFilter = glow ? `drop-shadow(0 0 3px ${color})` : undefined

  return (
    <svg
      viewBox={shape.viewBox}
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={cn('block h-full w-full overflow-visible', className)}
      style={{ color }}
    >
      {track && (
        <path
          d={shape.d}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      <path
        d={shape.d}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        strokeDasharray={animated ? 1 : undefined}
        style={glowFilter ? { filter: glowFilter } : undefined}
      >
        {animated && (
          <animate
            attributeName="stroke-dashoffset"
            values="1;0"
            dur={`${duration}s`}
            keyTimes="0;1"
            calcMode="spline"
            keySplines="0.4 0 0.2 1"
            fill="freeze"
          />
        )}
      </path>

      {endpoint && (
        <circle
          cx={ex}
          cy={ey}
          r={3}
          fill="currentColor"
          style={glowFilter ? { filter: glowFilter } : undefined}
        >
          {animated && (
            <animate
              attributeName="r"
              values="0;3.4;3"
              keyTimes="0;0.85;1"
              dur={`${duration}s`}
              fill="freeze"
            />
          )}
        </circle>
      )}
    </svg>
  )
}
