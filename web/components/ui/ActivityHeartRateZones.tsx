import { estimateHrZones, fmtDurationSec } from '@/lib/activities/detail'

export function ActivityHeartRateZones({ avgHr, maxHr, movingTimeSec }: {
  avgHr: number
  maxHr: number
  movingTimeSec: number
}) {
  const zones = estimateHrZones(avgHr, maxHr, movingTimeSec)
  const maxDuration = Math.max(...zones.map(z => z.durationSec), 1)

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <span className="text-xs text-gray-400">
          FC moy: <span className="text-white">{avgHr}</span> bpm
        </span>
        <span className="text-xs text-gray-400">
          FC max: <span className="text-white">{maxHr}</span> bpm
        </span>
      </div>

      {zones.map(zone => {
        const pct = Math.round((zone.durationSec / maxDuration) * 100)
        return (
          <div key={zone.label} className="flex items-center gap-2 py-1.5">
            <span className="w-24 text-xs shrink-0" style={{ color: zone.color }}>
              {zone.label}
            </span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className="h-2 rounded-full"
                style={{ width: `${pct}%`, backgroundColor: zone.color }}
              />
            </div>
            <span className="w-14 text-right text-xs text-gray-400 shrink-0">
              {fmtDurationSec(zone.durationSec)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
