import { splitPaceSec, splitColor, fmtPaceSec } from '@/lib/activities/detail'
import type { StravaSplit } from '@/lib/activities/detail'

export function ActivitySplits({
  splits,
  avgPaceSec,
}: {
  splits: StravaSplit[]
  avgPaceSec: number
}) {
  const paces = splits.map(s => splitPaceSec(s) ?? 0)
  const maxPace = Math.max(...paces, 1)

  return (
    <div className="flex flex-col">
      {splits.map((split, i) => {
        const pace = paces[i]
        const barPct = (pace / maxPace) * 100
        const color = splitColor(pace, avgPaceSec)
        const elev = split.elevation_difference

        return (
          <div key={split.split} className="flex items-center gap-2 py-1.5">
            <span className="w-6 text-right text-xs text-gray-400 shrink-0">
              {split.split}
            </span>

            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${barPct}%`, backgroundColor: color }}
              />
            </div>

            <span
              className="w-16 text-right text-xs font-mono shrink-0"
              style={{ color }}
            >
              {fmtPaceSec(pace)} /km
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
