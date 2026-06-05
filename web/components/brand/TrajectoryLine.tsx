import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────
// TrajectoryLine — élément graphique central de la marque Trail Cockpit.
// « Chemin schématisé » : un parcours sinueux jalonné d'étapes qui mène à un
// drapeau (l'objectif). La portion accomplie est pleine, le reste à parcourir
// est en pointillé. Symbolise progression, parcours, mission.
//
//   départ ●━━●━━●····◇ drapeau
//          (accompli)  (reste)
//
//   • SVG responsive, trait net (vector-effect non-scaling-stroke)
//   • orientation horizontale ou verticale
//   • `progress` (0→1) : part pleine vs pointillée + étapes atteintes/à venir
//   • mode animé (le chemin se dessine puis étapes/drapeau apparaissent — SMIL)
//
// Composant serveur (aucun hook) → utilisable partout, y compris en RSC.
// ─────────────────────────────────────────────────────────────────────────

type Orientation = 'horizontal' | 'vertical'
type Waypoint = { x: number; y: number; t: number } // t = fraction le long du chemin

type Shape = {
  viewBox: string
  d: string
  start: [number, number]
  end: [number, number]
  waypoints: Waypoint[]
}

type Props = {
  orientation?: Orientation
  /** Fraction accomplie (0→1) : plein jusqu'à `progress`, pointillé ensuite. */
  progress?: number
  /** true = le chemin se dessine puis étapes et drapeau apparaissent. */
  animated?: boolean
  /** Couleur du tracé (défaut : couleur de marque). */
  color?: string
  /** Épaisseur du trait en px (constante quelle que soit l'échelle). */
  strokeWidth?: number
  /** Affiche le drapeau d'arrivée (l'objectif). */
  endpoint?: boolean
  /** Affiche les points d'étape. */
  waypoints?: boolean
  /** Affiche le point de départ. */
  start?: boolean
  /** Affiche le « reste à parcourir » en pointillé. */
  track?: boolean
  /** Halo lumineux. */
  glow?: boolean
  /** Durée du tracé animé (s). */
  duration?: number
  className?: string
}

// Tracés bien sinueux (montées + replats), points d'ancrage ON-curve = étapes.
const SHAPES: Record<Orientation, Shape> = {
  horizontal: {
    viewBox: '0 0 100 46',
    d: 'M3,41 C 9,40 12,32 18,31 C 25,30 27,38 34,36 C 42,34 43,23 50,23 C 58,23 60,30 67,28 C 75,26 77,14 85,12 C 90,11 93,9 97,5',
    start: [3, 41],
    end: [97, 5],
    waypoints: [
      { x: 18, y: 31, t: 0.2 },
      { x: 50, y: 23, t: 0.5 },
      { x: 67, y: 28, t: 0.68 },
    ],
  },
  vertical: {
    viewBox: '0 0 46 100',
    d: 'M41,97 C 40,91 33,89 32,82 C 31,75 37,73 35,66 C 33,58 24,57 24,50 C 24,42 30,40 28,33 C 26,25 16,23 14,15 C 13,11 9,8 5,3',
    start: [41, 97],
    end: [5, 3],
    waypoints: [
      { x: 32, y: 82, t: 0.2 },
      { x: 24, y: 50, t: 0.5 },
      { x: 28, y: 33, t: 0.68 },
    ],
  },
}

export function TrajectoryLine({
  orientation = 'horizontal',
  progress = 0.6,
  animated = false,
  color = 'var(--primary)',
  strokeWidth = 2.5,
  endpoint = true,
  waypoints = true,
  start = true,
  track = true,
  glow = true,
  duration = 1.6,
  className,
}: Props) {
  const shape = SHAPES[orientation]
  const p = Math.max(0, Math.min(1, progress))
  const [sx, sy] = shape.start
  const [ex, ey] = shape.end
  const glowFilter = glow ? `drop-shadow(0 0 3px ${color})` : undefined
  const begin = (t: number) => `${(duration * t).toFixed(2)}s`
  const surface = 'var(--ink-900, #0B0F14)'

  return (
    <svg
      viewBox={shape.viewBox}
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={cn('block h-full w-full overflow-visible', className)}
      style={{ color }}
    >
      {/* Reste à parcourir — pointillé (le « plan ») sous le tracé plein */}
      {track && (
        <path
          d={shape.d}
          stroke="currentColor"
          strokeOpacity={0.45}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="0.004 0.026"
          pathLength={1}
        />
      )}

      {/* Portion accomplie — trait plein jusqu'à `progress` */}
      <path
        d={shape.d}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={animated ? '0 1' : `${p} 1`}
        style={glowFilter ? { filter: glowFilter } : undefined}
      >
        {animated && (
          <animate
            attributeName="stroke-dasharray"
            values={`0 1;${p} 1`}
            dur={`${duration}s`}
            keyTimes="0;1"
            calcMode="spline"
            keySplines="0.4 0 0.2 1"
            fill="freeze"
          />
        )}
      </path>

      {/* Point de départ — nœud creux */}
      {start && (
        <circle
          cx={sx}
          cy={sy}
          r={animated ? 0 : 2}
          fill={surface}
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        >
          {animated && <animate attributeName="r" values="0;2" begin={begin(0.04)} dur="0.25s" fill="freeze" />}
        </circle>
      )}

      {/* Étapes — pleines si atteintes (t ≤ progress), creuses si à venir */}
      {waypoints &&
        shape.waypoints.map((w, i) => {
          const reached = w.t <= p
          const popAt = animated ? begin(Math.min(0.82, Math.max(0.1, w.t))) : undefined
          return reached ? (
            <circle key={i} cx={w.x} cy={w.y} r={animated ? 0 : 2.1} fill="currentColor"
              style={glowFilter ? { filter: glowFilter } : undefined}>
              {animated && <animate attributeName="r" values="0;2.7;2.1" keyTimes="0;0.6;1" begin={popAt} dur="0.3s" fill="freeze" />}
            </circle>
          ) : (
            <circle key={i} cx={w.x} cy={w.y} r={animated ? 0 : 2} fill={surface}
              stroke="currentColor" strokeOpacity={0.6} strokeWidth={1.4} vectorEffect="non-scaling-stroke">
              {animated && <animate attributeName="r" values="0;2" begin={popAt} dur="0.3s" fill="freeze" />}
            </circle>
          )
        })}

      {/* Drapeau d'arrivée — l'objectif */}
      {endpoint && (
        <g style={glowFilter ? { filter: glowFilter } : undefined}>
          {animated && (
            <animateTransform attributeName="transform" type="translate" values="0 5;0 0"
              begin={begin(0.86)} dur="0.35s" calcMode="spline" keySplines="0.22 1 0.36 1" fill="freeze" />
          )}
          <g opacity={animated ? 0 : 1}>
            {animated && <animate attributeName="opacity" values="0;1" begin={begin(0.86)} dur="0.25s" fill="freeze" />}
            {/* base */}
            <circle cx={ex} cy={ey} r={1.8} fill="currentColor" />
            {/* mât */}
            <line x1={ex} y1={ey} x2={ex} y2={ey - 11} stroke="currentColor" strokeWidth={1.6}
              strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {/* fanion */}
            <path d={`M${ex},${ey - 11} L${ex + 8.5},${ey - 8.7} L${ex},${ey - 6.4} Z`} fill="currentColor" />
          </g>
        </g>
      )}
    </svg>
  )
}
