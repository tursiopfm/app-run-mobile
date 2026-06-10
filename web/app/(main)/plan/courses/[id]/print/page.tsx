'use client'

// Export PDF — carte de course format iPhone (cf. Prompts/tableau-course-pdf-mockup.html).
// À imprimer sur A4 paysage, découper le long des pointillés, plastifier.
import { useEffect, useState } from 'react'
import type { Race, RaceWaypoint } from '@/types/plan'
import { getRaces } from '@/lib/plan/storage'
import { estimatePassageTimes } from '@/lib/plan/pacing'
import { deriveSegment, formatElapsedToClock, formatBarrierClock } from '@/lib/plan/waypoint-view'

const fmt = (n: number) => String(n).replace('.', ',')
const pad = (n: number) => String(n).padStart(2, '0')

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
      const t = setTimeout(() => window.print(), 500)
      return () => clearTimeout(t)
    }
  }, [ready, wps.length])

  if (!ready) return <div className="p-6 text-sm">Préparation…</div>
  if (!race) return <div className="p-6 text-sm">Course introuvable.</div>

  const totalSec = race.targetDurationMin != null ? race.targetDurationMin * 60 : null
  const elapsed = totalSec != null
    ? estimatePassageTimes(
        wps.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
        { totalDurationSec: totalSec, fade: race.pacingFade ?? 0 },
      )
    : null
  const startClock = race.startTime ? formatElapsedToClock(race.startTime, 0)?.label : null
  const arrClock = race.startTime && totalSec != null ? formatElapsedToClock(race.startTime, totalSec)?.label : null
  const goal = race.targetDurationMin != null
    ? `${Math.floor(race.targetDurationMin / 60)} h ${pad(race.targetDurationMin % 60)}`
    : null

  return (
    <div className="pdfroot">
      <style>{`
        .pdfroot{
          --ink:#0E1513; --ink-soft:#55615E; --ink-faint:#8A938F;
          --line:#C9D1CE; --line-strong:#2A332F; --zebra:#F2F5F4; --seg-bg:#FBF1EA; --accent:#C44E22;
          --d:'Space Grotesk',var(--font-display,system-ui),sans-serif;
          background:#3A4441; min-height:100vh; display:flex; flex-direction:column; align-items:center;
          padding:28px 16px 60px; color:var(--ink); font-family:system-ui,sans-serif;
        }
        .pdfroot .toolbar{display:flex;gap:10px;align-items:center;color:#D7DEDB;font-size:13px;margin-bottom:8px;width:120mm;max-width:100%;}
        .pdfroot .toolbar .ttl{font-family:var(--d);font-weight:600;font-size:14px;margin-right:auto;}
        .pdfroot .btn{font-family:var(--d);font-weight:600;font-size:13px;padding:8px 14px;border-radius:10px;border:0;background:var(--accent);color:#fff;cursor:pointer;}
        .pdfroot .caption{width:120mm;max-width:100%;color:#AEB7B4;font-size:11px;margin-bottom:16px;line-height:1.4;}
        .pdfroot .cut{padding:6mm;border:1px dashed #7B8A86;border-radius:6px;background:#222927;}
        .pdfroot .scis{font-size:10px;color:#7B8A86;margin-bottom:4px;display:block;}
        .pdfroot .card{width:120mm;height:65mm;background:#fff;color:var(--ink);border-radius:2.5mm;display:flex;flex-direction:column;overflow:hidden;padding:1.1mm 2mm;box-shadow:0 18px 40px -16px rgba(0,0,0,.6);}
        .pdfroot .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.4px solid var(--line-strong);padding-bottom:1.5px;flex:none;}
        .pdfroot .race{font-family:var(--d);font-size:9px;font-weight:700;letter-spacing:-.2px;white-space:nowrap;line-height:1.1;}
        .pdfroot .stats{font-family:var(--d);font-size:5.8px;color:var(--ink-soft);font-weight:600;white-space:nowrap;}
        .pdfroot .stats b{color:var(--ink);}
        .pdfroot .goal{font-family:var(--d);font-size:8.5px;color:var(--accent);font-weight:700;white-space:nowrap;}
        .pdfroot .goal .lbl{color:var(--ink-faint);font-size:6px;font-weight:600;}
        .pdfroot table{width:100%;border-collapse:collapse;flex:1;margin-top:1px;table-layout:fixed;}
        .pdfroot thead th{font-family:var(--d);font-size:5.5px;font-weight:700;letter-spacing:.1px;text-transform:uppercase;color:var(--ink-soft);text-align:left;padding:1px 1.5px 2px;border-bottom:1px solid var(--line-strong);line-height:1;}
        .pdfroot thead th.r{text-align:right;}
        .pdfroot thead th.seg{background:var(--seg-bg);text-align:right;}
        .pdfroot tbody tr{border-bottom:.5px solid var(--line);}
        .pdfroot tbody tr:nth-child(even){background:var(--zebra);}
        .pdfroot tbody td{padding:.2px 1.5px;vertical-align:middle;line-height:10px;font-size:9px;}
        .pdfroot col.w-tk{width:3%;} .pdfroot col.w-pt{width:21%;} .pdfroot col.w-km{width:7.5%;} .pdfroot col.w-cum{width:7%;}
        .pdfroot col.w-int{width:8%;} .pdfroot col.w-dp{width:7.5%;} .pdfroot col.w-dm{width:7.5%;}
        .pdfroot col.w-rav{width:9%;} .pdfroot col.w-obj{width:13.5%;} .pdfroot col.w-bh{width:13%;}
        .pdfroot .tk{width:8px;height:8px;border:1px solid var(--ink-faint);border-radius:2px;display:block;}
        .pdfroot .pt{font-family:var(--d);font-size:8.7px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;}
        .pdfroot td.c-km,.pdfroot td.c-cum{text-align:right;}
        .pdfroot .km{font-family:var(--d);font-size:8.7px;font-weight:700;}
        .pdfroot .cum{font-family:var(--d);font-size:7px;font-weight:600;color:var(--ink-soft);}
        .pdfroot th.seg,.pdfroot td.seg{background:var(--seg-bg);text-align:right;}
        .pdfroot th.seg.first,.pdfroot td.seg.first{border-left:1px solid var(--line-strong);}
        .pdfroot th.seg.last,.pdfroot td.seg.last{border-right:1px solid var(--line-strong);}
        .pdfroot .sv{font-family:var(--d);font-size:8px;font-weight:700;white-space:nowrap;}
        .pdfroot .sv.dp .ar{color:var(--accent);font-size:5.5px;}
        .pdfroot .sv.dm{color:var(--ink-soft);} .pdfroot .sv.dm .ar{font-size:5.5px;}
        .pdfroot .sv .dash{color:var(--ink-faint);font-weight:500;}
        .pdfroot .rav{display:inline-flex;gap:1.5px;}
        .pdfroot .rb{font-family:var(--d);font-weight:700;font-size:5.5px;min-width:8px;height:8px;padding:0 1px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--ink);border-radius:2.5px;color:var(--ink);line-height:1;}
        .pdfroot .rb.bv{background:var(--ink);color:#fff;}
        .pdfroot td.c-obj{text-align:right;}
        .pdfroot .obj{font-family:var(--d);font-size:9.5px;font-weight:700;}
        .pdfroot .obj .none{color:var(--ink-faint);font-size:8px;font-weight:500;}
        .pdfroot td.c-bh{text-align:right;}
        .pdfroot .bh{font-family:var(--d);font-size:7px;font-weight:500;color:var(--ink-soft);white-space:nowrap;}
        .pdfroot .bh .none{color:var(--ink-faint);}
        .pdfroot tr.is-base td:not(.seg){background:#E9EEEC;}
        .pdfroot tr.is-end .pt,.pdfroot tr.is-start .pt{color:var(--accent);}
        .pdfroot .legend{flex:none;display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:.5px;padding-top:1px;border-top:1px solid var(--line-strong);font-family:var(--d);font-size:5.2px;color:var(--ink-soft);font-weight:600;line-height:1.2;}
        .pdfroot .legend .k{display:inline-flex;align-items:center;gap:3px;}
        .pdfroot .legend .rb{transform:scale(.78);}
        .pdfroot .legend .sw{width:11px;height:6px;background:var(--seg-bg);border:1px solid var(--line-strong);display:inline-block;border-radius:2px;}

        @page{size:A4 landscape;margin:12mm;}
        @media print{
          body * { visibility:hidden !important; }
          .pdfroot, .pdfroot * { visibility:visible !important; }
          .pdfroot{position:absolute;top:0;left:0;width:100%;background:#fff;padding:0;min-height:auto;display:block;}
          .pdfroot .toolbar,.pdfroot .caption{display:none !important;}
          .pdfroot .cut{border:none;background:none;padding:0;margin:8mm auto 0;width:120mm;}
          .pdfroot .scis{display:none;}
          .pdfroot .card{box-shadow:none;border:.5px solid var(--line);}
          .pdfroot tbody tr:nth-child(even){background:var(--zebra) !important;}
          .pdfroot tr.is-base td:not(.seg){background:#E9EEEC !important;}
          .pdfroot th.seg,.pdfroot td.seg{background:var(--seg-bg) !important;}
          .pdfroot .rb.bv{background:#000 !important;color:#fff !important;}
          *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        }
      `}</style>

      <div className="toolbar">
        <span className="ttl">Carte de course · format iPhone</span>
        <button className="btn" onClick={() => window.print()}>Imprimer / Enregistrer en PDF</button>
      </div>
      <p className="caption">Imprime sur A4 paysage (échelle 100 %), découpe le long des pointillés, plastifie. Tient dans une poche de veste.</p>

      <div className="cut">
        <span className="scis">✂ — — — — — — — — découper — — — — — — — —</span>

        <div className="card">
          <div className="hd">
            <div>
              <div className="race">{race.name}</div>
              <div className="stats">
                <b>{race.distance} km</b> · <b>{race.elevation} D+</b> · {wps.length} pts
                {startClock ? <> · Dép. <b>{startClock}</b></> : null}
                {arrClock ? <> · Arr. visée <b>{arrClock}</b></> : null}
              </div>
            </div>
            {goal ? <div className="goal"><span className="lbl">Objectif</span> {goal}</div> : null}
          </div>

          <table>
            <colgroup>
              <col className="w-tk" /><col className="w-pt" /><col className="w-km" /><col className="w-cum" />
              <col className="w-int" /><col className="w-dp" /><col className="w-dm" />
              <col className="w-rav" /><col className="w-obj" /><col className="w-bh" />
            </colgroup>
            <thead>
              <tr>
                <th></th><th>Point</th><th className="r">Km</th><th className="r">ΣD+</th>
                <th className="seg first r">Inter</th><th className="seg r">▲D+</th><th className="seg last r">▼D−</th>
                <th>Ravito</th><th className="r">Objectif</th><th className="r">Barrière</th>
              </tr>
            </thead>
            <tbody>
              {wps.map((w, i) => {
                const seg = deriveSegment(wps.map((x) => ({ km: x.km, dPlus: x.dPlus, dMoins: x.dMoins })), i)
                const isStart = i === 0
                const isEnd = i === wps.length - 1
                const isBase = w.supplies.includes('base_vie')
                const objLabel = elapsed && race.startTime ? formatElapsedToClock(race.startTime, elapsed[i])?.label : null
                const bhLabel = formatBarrierClock(race.startTime, w.cutoffRaw, w.cutoffKind, elapsed?.[i] ?? 0)
                const rowCls = isStart ? 'is-start' : isEnd ? 'is-end' : isBase ? 'is-base' : ''
                return (
                  <tr key={w.id} className={rowCls}>
                    <td><span className="tk" /></td>
                    <td><span className="pt">{w.name}</span></td>
                    <td className="c-km"><span className="km">{fmt(w.km)}</span></td>
                    <td className="c-cum"><span className="cum">{w.dPlus ?? 0}</span></td>
                    <td className="seg first"><span className="sv">{seg.interKm != null ? fmt(seg.interKm) : <span className="dash">—</span>}</span></td>
                    <td className="seg"><span className="sv dp">{seg.dPlusSeg != null ? <><span className="ar">▲</span>{seg.dPlusSeg}</> : <span className="dash">—</span>}</span></td>
                    <td className="seg last"><span className="sv dm">{seg.dMoinsSeg != null ? <><span className="ar">▼</span>{seg.dMoinsSeg}</> : <span className="dash">—</span>}</span></td>
                    <td>
                      <span className="rav">
                        {w.supplies.includes('solid') && <span className="rb">S</span>}
                        {w.supplies.includes('liquid') && <span className="rb">L</span>}
                        {w.supplies.includes('base_vie') && <span className="rb bv">BV</span>}
                      </span>
                    </td>
                    <td className="c-obj"><span className="obj">{objLabel ?? <span className="none">—</span>}</span></td>
                    <td className="c-bh"><span className="bh">{bhLabel ?? <span className="none">—</span>}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="legend">
            <span className="k"><span className="sw" /> Tronçon : Inter · ▲D+ · ▼D− (depuis pt préc.)</span>
            <span className="k">ΣD+ = cumulé</span>
            <span className="k"><span className="rb">S</span>solide</span>
            <span className="k"><span className="rb">L</span>liquide</span>
            <span className="k"><span className="rb bv">BV</span>base vie</span>
            <span className="k" style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>Obj = heure visée · Barrière = limite</span>
          </div>
        </div>
      </div>
    </div>
  )
}
