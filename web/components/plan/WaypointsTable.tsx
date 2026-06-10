'use client'

// Tableau éditable des points de passage. Colonnes auto (Inter, ▲/▼ tronçon)
// dérivées du cumulé via lib/plan/waypoint-view ; Objectif calculé via
// lib/plan/pacing, override éditable. Pas d'undo (re-import pour reset).
import { useCallback, useMemo } from 'react'
import type { RaceWaypoint, WaypointSupply } from '@/types/plan'
import { deriveSegment, formatElapsedToClock, parseClockToElapsed } from '@/lib/plan/waypoint-view'
import { estimatePassageTimes } from '@/lib/plan/pacing'

type Draft = Omit<RaceWaypoint, 'id' | 'raceId'>

type Props = {
  waypoints: Draft[]
  onChange: (next: Draft[]) => void
  readOnly?: boolean
  // Pacing (optionnel) : si absent, la colonne Objectif affiche '—'.
  startTime?: string
  targetDurationMin?: number
  pacingFade?: number
}

const SUPPLY_TOGGLES: { value: WaypointSupply; label: string }[] = [
  { value: 'solid',    label: 'S' },
  { value: 'liquid',   label: 'L' },
  { value: 'base_vie', label: 'BV' },
]

function reindex(rows: Draft[]): Draft[] {
  const sorted = [...rows].sort((a, b) => a.km - b.km)
  return sorted.map((r, i) => ({
    ...r,
    orderIndex: i,
    type: i === 0 ? 'depart' : i === sorted.length - 1 ? 'arrivee' : r.type,
  }))
}

export function WaypointsTable({
  waypoints, onChange, readOnly, startTime, targetDurationMin, pacingFade,
}: Props) {
  const update = useCallback(
    (i: number, patch: Partial<Draft>) => {
      const next = waypoints.map((w, idx) => (idx === i ? { ...w, ...patch } : w))
      onChange(reindex(next))
    },
    [waypoints, onChange],
  )

  // Heures de passage (s écoulées) calculées par le pacing si configuré.
  const elapsed = useMemo(() => {
    if (targetDurationMin == null) return null
    return estimatePassageTimes(
      waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
      { totalDurationSec: targetDurationMin * 60, fade: pacingFade ?? 0 },
    )
  }, [waypoints, targetDurationMin, pacingFade])

  const toggleSupply = (i: number, s: WaypointSupply) => {
    const cur = waypoints[i].supplies
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    update(i, { supplies: next })
  }

  const onObjectifBlur = (i: number, raw: string) => {
    if (!startTime || elapsed == null) return
    const v = raw.trim()
    if (v === '') { update(i, { targetOverrideSec: null }); return }
    const min = i > 0 && elapsed[i - 1] != null ? elapsed[i - 1] : 0
    const sec = parseClockToElapsed(startTime, v, min)
    if (sec != null) update(i, { targetOverrideSec: sec })
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-caption text-trail-text">
          <thead>
            <tr className="text-trail-muted text-micro">
              <th className="text-left p-1">Point</th>
              <th className="text-right p-1">Km</th>
              <th className="text-right p-1">ΣD+</th>
              <th className="text-right p-1">Inter</th>
              <th className="text-right p-1">▲D+</th>
              <th className="text-right p-1">▼D−</th>
              <th className="text-left p-1">Ravito</th>
              <th className="text-right p-1">Objectif</th>
              <th className="text-left p-1">Barrière</th>
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {waypoints.map((w, i) => {
              const seg = deriveSegment(
                waypoints.map((x) => ({ km: x.km, dPlus: x.dPlus, dMoins: x.dMoins })),
                i,
              )
              const clock =
                elapsed && startTime ? formatElapsedToClock(startTime, elapsed[i]) : null
              const isOverride = w.targetOverrideSec != null
              return (
                <tr key={`${w.orderIndex}-${i}`} className="border-t border-trail-border">
                  <td className="p-1">
                    <input type="text" value={w.name} disabled={readOnly}
                      onChange={(e) => update(i, { name: e.target.value })}
                      className="w-full bg-transparent outline-none" />
                  </td>
                  <td className="p-1 w-[54px]">
                    <input type="number" step="0.1" value={w.km} disabled={readOnly}
                      onChange={(e) => update(i, { km: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent outline-none text-right" />
                  </td>
                  <td className="p-1 w-[54px]">
                    <input type="number" value={w.dPlus ?? ''} disabled={readOnly}
                      onChange={(e) => update(i, { dPlus: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                      className="w-full bg-transparent outline-none text-right" />
                  </td>
                  <td className="p-1 w-[48px] text-right text-trail-muted">
                    {seg.interKm ?? '—'}
                  </td>
                  <td className="p-1 w-[48px] text-right" style={{ color: 'var(--trail-primary)' }}>
                    {seg.dPlusSeg ?? '—'}
                  </td>
                  <td className="p-1 w-[48px] text-right text-trail-muted">
                    {seg.dMoinsSeg ?? '—'}
                  </td>
                  <td className="p-1">
                    <div className="flex gap-1">
                      {SUPPLY_TOGGLES.map((s) => {
                        const on = w.supplies.includes(s.value)
                        return (
                          <button key={s.value} type="button" disabled={readOnly}
                            onClick={() => toggleSupply(i, s.value)}
                            aria-pressed={on}
                            className={`px-1 rounded text-micro font-bold border ${
                              on ? 'bg-trail-primary text-white border-trail-primary'
                                 : 'text-trail-muted border-trail-border'
                            }`}>
                            {s.label}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td className="p-1 w-[64px] text-right">
                    {targetDurationMin == null ? (
                      <span className="text-trail-muted">—</span>
                    ) : (
                      <input type="text" disabled={readOnly} placeholder="—"
                        defaultValue={clock?.label ?? ''}
                        key={`${clock?.label ?? ''}-${isOverride}`}
                        onBlur={(e) => onObjectifBlur(i, e.target.value)}
                        className={`w-full bg-transparent outline-none text-right ${
                          isOverride ? 'font-bold text-trail-text' : 'text-trail-muted'
                        }`} />
                    )}
                  </td>
                  <td className="p-1">
                    <input type="text" value={w.cutoffRaw ?? ''} disabled={readOnly} placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value || null
                        update(i, { cutoffRaw: v, cutoffKind: v === null ? null : w.cutoffKind ?? 'clock_time' })
                      }}
                      className="w-[64px] bg-transparent outline-none" />
                  </td>
                  {!readOnly && (
                    <td className="p-1 w-[24px]">
                      <button type="button" onClick={() => onChange(reindex(waypoints.filter((_, idx) => idx !== i)))}
                        aria-label={`Supprimer ${w.name || 'ligne'}`}
                        className="text-trail-danger text-body">×</button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
