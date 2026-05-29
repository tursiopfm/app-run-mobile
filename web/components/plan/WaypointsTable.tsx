'use client'

// Tableau éditable inline des points de passage d'une course.
// Pas d'undo en phase 1 — re-import si besoin de reset.
import { useCallback } from 'react'
import type { RaceWaypoint, CutoffKind, WaypointType } from '@/types/plan'

type Draft = Omit<RaceWaypoint, 'id' | 'raceId'>

type Props = {
  waypoints: Draft[]
  onChange: (next: Draft[]) => void
  readOnly?: boolean
}

const TYPE_OPTIONS: { value: WaypointType; label: string }[] = [
  { value: 'depart',   label: 'Départ' },
  { value: 'ravito',   label: 'Ravito' },
  { value: 'pointage', label: 'Pointage' },
  { value: 'arrivee',  label: 'Arrivée' },
  { value: 'autre',    label: 'Autre' },
]

const KIND_OPTIONS: { value: CutoffKind; label: string }[] = [
  { value: 'clock_time', label: 'Heure' },
  { value: 'elapsed',    label: 'Temps' },
  { value: 'unknown',    label: '?' },
]

function emptyRow(orderIndex: number): Draft {
  return {
    orderIndex,
    name: '',
    km: 0,
    kmInter: null,
    dPlus: null,
    dMoins: null,
    cutoffRaw: null,
    cutoffKind: null,
    type: orderIndex === 0 ? 'depart' : 'ravito',
  }
}

function reindex(rows: Draft[]): Draft[] {
  const sorted = [...rows].sort((a, b) => a.km - b.km)
  return sorted.map((r, i) => ({
    ...r,
    orderIndex: i,
    type:
      i === 0 ? 'depart' :
      i === sorted.length - 1 ? 'arrivee' :
      r.type,
  }))
}

export function WaypointsTable({ waypoints, onChange, readOnly }: Props) {
  const update = useCallback(
    (i: number, patch: Partial<Draft>) => {
      const next = waypoints.map((w, idx) => (idx === i ? { ...w, ...patch } : w))
      onChange(reindex(next))
    },
    [waypoints, onChange],
  )

  const remove = useCallback(
    (i: number) => {
      onChange(reindex(waypoints.filter((_, idx) => idx !== i)))
    },
    [waypoints, onChange],
  )

  const add = useCallback(() => {
    onChange(reindex([...waypoints, emptyRow(waypoints.length)]))
  }, [waypoints, onChange])

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] text-trail-text">
          <thead>
            <tr className="text-trail-muted text-[11px]">
              <th className="text-left p-1">Point</th>
              <th className="text-right p-1">Dist</th>
              <th className="text-right p-1">Inter</th>
              <th className="text-right p-1">D+</th>
              <th className="text-right p-1">D−</th>
              <th className="text-left p-1">BH</th>
              <th className="text-left p-1">Type</th>
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {waypoints.map((w, i) => (
              <tr key={`${w.orderIndex}-${i}`} className="border-t border-trail-border">
                <td className="p-1">
                  <input
                    type="text"
                    value={w.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    disabled={readOnly}
                    className="w-full bg-transparent outline-none"
                  />
                </td>
                <td className="p-1 w-[60px]">
                  <input
                    type="number" step="0.1"
                    value={w.km}
                    onChange={(e) => update(i, { km: parseFloat(e.target.value) || 0 })}
                    disabled={readOnly}
                    className="w-full bg-transparent outline-none text-right"
                  />
                </td>
                <td className="p-1 w-[60px]">
                  <input
                    type="number" step="0.1"
                    value={w.kmInter ?? ''}
                    onChange={(e) =>
                      update(i, { kmInter: e.target.value === '' ? null : parseFloat(e.target.value) })
                    }
                    disabled={readOnly}
                    className="w-full bg-transparent outline-none text-right"
                  />
                </td>
                <td className="p-1 w-[60px]">
                  <input
                    type="number"
                    value={w.dPlus ?? ''}
                    onChange={(e) =>
                      update(i, { dPlus: e.target.value === '' ? null : parseInt(e.target.value, 10) })
                    }
                    disabled={readOnly}
                    className="w-full bg-transparent outline-none text-right"
                  />
                </td>
                <td className="p-1 w-[60px]">
                  <input
                    type="number"
                    value={w.dMoins ?? ''}
                    onChange={(e) =>
                      update(i, { dMoins: e.target.value === '' ? null : parseInt(e.target.value, 10) })
                    }
                    disabled={readOnly}
                    className="w-full bg-transparent outline-none text-right"
                  />
                </td>
                <td className="p-1">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={w.cutoffRaw ?? ''}
                      onChange={(e) => {
                        const v = e.target.value || null
                        update(i, {
                          cutoffRaw: v,
                          cutoffKind: v === null ? null : w.cutoffKind ?? 'unknown',
                        })
                      }}
                      disabled={readOnly}
                      className="w-[60px] bg-transparent outline-none"
                      placeholder="—"
                    />
                    {w.cutoffRaw && (
                      <select
                        value={w.cutoffKind ?? 'unknown'}
                        onChange={(e) => update(i, { cutoffKind: e.target.value as CutoffKind })}
                        disabled={readOnly}
                        className="bg-transparent outline-none text-[11px]"
                      >
                        {KIND_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </td>
                <td className="p-1">
                  <select
                    value={w.type}
                    onChange={(e) => update(i, { type: e.target.value as WaypointType })}
                    disabled={readOnly}
                    className="bg-transparent outline-none"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>
                {!readOnly && (
                  <td className="p-1 w-[28px]">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label={`Supprimer ${w.name || 'ligne'}`}
                      className="text-trail-danger text-[14px]"
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={add}
          className="text-[12px] text-trail-primary underline"
        >
          + Ajouter une ligne
        </button>
      )}
    </div>
  )
}
