'use client'

import { useEffect, useState } from 'react'
import type { Race, RaceWaypoint, WaypointSupply } from '@/types/plan'
import { getRaces } from '@/lib/plan/storage'
import { estimatePassageTimes } from '@/lib/plan/pacing'
import { deriveSegment, formatElapsedToClock } from '@/lib/plan/waypoint-view'

const SUP: Record<WaypointSupply, string> = { solid: 'S', liquid: 'L', base_vie: 'BV' }

export default function PrintCoursePage({ params }: { params: { id: string } }) {
  const [race, setRace] = useState<Race | null>(null)
  const [wps, setWps] = useState<RaceWaypoint[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      const races = await getRaces()
      setRace(races.find((r) => r.id === params.id) ?? null)
      const res = await fetch(`/api/races/${params.id}/waypoints`)
      if (res.ok) setWps((await res.json()).waypoints ?? [])
      setReady(true)
    })()
  }, [params.id])

  useEffect(() => {
    if (ready && wps.length > 0) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [ready, wps.length])

  const elapsed =
    race?.targetDurationMin != null
      ? estimatePassageTimes(
          wps.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
          { totalDurationSec: race.targetDurationMin * 60, fade: race.pacingFade ?? 0 },
        )
      : null

  if (!ready) return <div className="p-6 text-sm">Préparation…</div>
  if (!race) return <div className="p-6 text-sm">Course introuvable.</div>

  return (
    <div className="print-root">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        .print-root { background: #fff; color: #0E1513; font-family: system-ui, sans-serif; padding: 8mm; }
        .print-root h1 { font-size: 16px; font-weight: 700; margin: 0; }
        .print-root .sub { font-size: 10px; color: #55615E; margin: 2px 0 8px; }
        .print-root table { width: 100%; border-collapse: collapse; }
        .print-root th, .print-root td { padding: 3px 5px; font-size: 11px; border-bottom: .5px solid #C9D1CE; }
        .print-root th { text-align: left; font-size: 9px; text-transform: uppercase; color: #55615E; border-bottom: 1px solid #2A332F; }
        .print-root td.r, .print-root th.r { text-align: right; }
        .print-root thead { display: table-header-group; }
        .print-root tr { break-inside: avoid; }
        .print-root .bv { font-weight: 700; }
        @media screen {
          .print-root { max-width: 1000px; margin: 16px auto; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
          .toolbar { max-width: 1000px; margin: 12px auto 0; }
        }
        @media print { .toolbar { display: none; } }
      `}</style>

      <div className="toolbar">
        <button onClick={() => window.print()}
          style={{ padding: '8px 14px', borderRadius: 8, background: '#C44E22', color: '#fff', border: 0, fontWeight: 600 }}>
          Imprimer / Enregistrer en PDF
        </button>
      </div>

      <h1>{race.name}</h1>
      <div className="sub">
        {race.distance} km · {race.elevation} m D+
        {race.startTime ? ` · Départ ${race.startTime}` : ''}
        {race.targetDurationMin != null
          ? ` · Objectif ${Math.floor(race.targetDurationMin / 60)} h ${String(race.targetDurationMin % 60).padStart(2, '0')}`
          : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Point</th><th className="r">Km</th><th className="r">ΣD+</th>
            <th className="r">Inter</th><th className="r">▲D+</th><th className="r">▼D−</th>
            <th>Ravito</th><th className="r">Objectif</th><th>Barrière</th>
          </tr>
        </thead>
        <tbody>
          {wps.map((w, i) => {
            const seg = deriveSegment(wps.map((x) => ({ km: x.km, dPlus: x.dPlus, dMoins: x.dMoins })), i)
            const clock = elapsed && race.startTime ? formatElapsedToClock(race.startTime, elapsed[i]) : null
            return (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td className="r">{w.km}</td>
                <td className="r">{w.dPlus ?? '—'}</td>
                <td className="r">{seg.interKm ?? '—'}</td>
                <td className="r">{seg.dPlusSeg ?? '—'}</td>
                <td className="r">{seg.dMoinsSeg ?? '—'}</td>
                <td>{w.supplies.map((s) => SUP[s]).join(' ') || '—'}</td>
                <td className="r">{clock?.label ?? '—'}</td>
                <td>{w.cutoffRaw ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
