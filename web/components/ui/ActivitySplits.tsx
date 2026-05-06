import { splitPaceSec, splitColor, fmtPaceSec } from '@/lib/activities/detail'
import type { StravaSplit } from '@/lib/activities/detail'

export function ActivitySplits({
  splits,
  avgPaceSec,
}: {
  splits: StravaSplit[]
  avgPaceSec: number
}) {
  if (!splits.length) return null

  const paces = splits.map(s => splitPaceSec(s))
  const validPaces = paces.filter((p): p is number => p !== null)
  const maxPace = validPaces.length ? Math.max(...validPaces) : 1
  const minPace = validPaces.length ? Math.min(...validPaces) : null

  return (
    <div className="flex flex-col">
      {/* Header: segment count + best split */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-gray-500">{splits.length} segments</span>
        {minPace !== null && (
          <span className="text-xs font-mono" style={{ color: splitColor(minPace, avgPaceSec) }}>
            ★ Meilleur {fmtPaceSec(minPace)}
          </span>
        )}
      </div>

      {splits.map((split, i) => {
        const pace = paces[i]
        if (pace === null) return null

        const barPct = (pace / maxPace) * 100
        const color = splitColor(pace, avgPaceSec)
        const elev = Math.round(split.elevation_difference)

        return (
          <div key={split.split} className="flex items-center gap-2 py-1.5">
            {/* Circular badge */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-gray-400 shrink-0"
              style={{ backgroundColor: '#1e2433' }}
            >
              {split.split}
            </div>

            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${barPct}%`, backgroundColor: color }}
              />
            </div>

            <span
              className="w-12 text-right text-xs font-mono shrink-0"
              style={{ color }}
            >
              {fmtPaceSec(pace)}
            </span>

            <span className="w-8 text-xs text-gray-500 shrink-0">
              {elev > 0 ? `↑${elev}m` : elev < 0 ? `↓${Math.abs(elev)}m` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
