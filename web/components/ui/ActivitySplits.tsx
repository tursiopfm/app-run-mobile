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
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header: segment count + best split */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: '#6b7a96' }}>{splits.length} segments</span>
        {minPace !== null && (
          <span style={{ fontSize: 12, fontWeight: 700, color: splitColor(minPace, avgPaceSec) }}>
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
          <div
            key={split.split}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 0', borderBottom: '1px solid #161a24',
            }}
          >
            {/* Circular km badge */}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#181c29', border: '1px solid #252836',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: '#8892a4', flexShrink: 0,
            }}>
              {split.split}
            </div>

            {/* Progress bar */}
            <div style={{ flex: 1, height: 8, background: '#181c29', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 4, backgroundColor: color }} />
            </div>

            {/* Pace */}
            <span style={{
              fontSize: 11, fontWeight: 800, width: 34, textAlign: 'right',
              color, flexShrink: 0,
            }}>
              {fmtPaceSec(pace)}
            </span>

            {/* Elevation */}
            <span style={{
              fontSize: 9, width: 34, textAlign: 'right', flexShrink: 0,
              color: elev > 0 ? '#8bc34a' : elev < 0 ? '#4db6f0' : '#8892a4',
            }}>
              {elev > 0 ? `↑${elev}m` : elev < 0 ? `↓${Math.abs(elev)}m` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
