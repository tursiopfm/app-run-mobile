'use client'

// Tableau éditable des points de passage — design « Option A · Compact »
// (cf. Prompts/tableau-course-mockup-optionA.html) : grille fixe (zéro scroll X),
// ravito en icônes, dist+inter et cumul+segment empilés, objectif = temps écoulé
// éditable + marge colorée avant barrière. Colonnes auto via lib/plan/waypoint-view,
// heures via lib/plan/pacing. Pas d'undo (re-import pour reset).
import { useCallback, useMemo } from 'react'
import type { RaceWaypoint, WaypointSupply } from '@/types/plan'
import {
  deriveSegment, formatElapsedShort, parseElapsedShort, marginToBarrier, formatMargin,
} from '@/lib/plan/waypoint-view'
import { estimatePassageTimes } from '@/lib/plan/pacing'

type Draft = Omit<RaceWaypoint, 'id' | 'raceId'>

type Props = {
  waypoints: Draft[]
  onChange: (next: Draft[]) => void
  readOnly?: boolean
  // Pacing (optionnel) : si absent, la colonne Objectif reste vide.
  startTime?: string
  targetDurationMin?: number
  pacingFade?: number
}

const ICONS = {
  sol:  'M4 3v7a2 2 0 0 0 2 2v9M8 3v7a2 2 0 0 1-2 2M17 3c-1.6 0-3 2-3 5.5S15.4 14 17 14v7',
  liq:  'M12 3s6.5 7.2 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10.2 12 3 12 3z',
  base: 'M3 20 12 4l9 16M12 5v15M3 20h18',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  go:   'M7 4 19 12 7 20z',
} as const

function Icon({ name }: { name: keyof typeof ICONS }) {
  const solid = name === 'go'
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ display: 'block' }}>
      <path d={ICONS[name]} fill={solid ? 'currentColor' : 'none'} stroke={solid ? 'none' : 'currentColor'}
        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const SUPPLIES: { val: WaypointSupply; cls: 'sol' | 'liq' | 'base'; icon: keyof typeof ICONS }[] = [
  { val: 'solid',    cls: 'sol',  icon: 'sol' },
  { val: 'liquid',   cls: 'liq',  icon: 'liq' },
  { val: 'base_vie', cls: 'base', icon: 'base' },
]

const fmtKm = (n: number) => String(n).replace('.', ',')

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

  const elapsed = useMemo(() => {
    if (targetDurationMin == null) return null
    return estimatePassageTimes(
      waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
      { totalDurationSec: targetDurationMin * 60, fade: pacingFade ?? 0 },
    )
  }, [waypoints, targetDurationMin, pacingFade])

  const segInputs = useMemo(
    () => waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, dMoins: w.dMoins })),
    [waypoints],
  )

  const toggleSupply = (i: number, s: WaypointSupply) => {
    const cur = waypoints[i].supplies
    update(i, { supplies: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] })
  }

  const onObjBlur = (i: number, raw: string) => {
    const v = raw.trim()
    if (v === '') { update(i, { targetOverrideSec: null }); return }
    const sec = parseElapsedShort(v)
    if (sec != null) update(i, { targetOverrideSec: sec })
  }

  return (
    <div className="wtbl">
      <style>{`
        .wtbl{
          --card:#162420;--border:#1E3530;--border2:#274840;--text:#E2ECE9;--muted:#8BA8A3;--faint:#5E7A75;
          --orange:#FF6B35;--blue:#38BDF8;--green:#4ADE80;--yellow:#FBBF24;--red:#F87171;
          --d:'Space Grotesk',var(--font-display,system-ui),sans-serif;color:var(--text);
        }
        .wtbl .legend-mini{font-size:9.5px;color:var(--faint);padding:0 3px 8px;line-height:1.4;}
        .wtbl .legend-mini b{color:var(--blue);font-weight:600;}
        .wtbl .gA{display:grid;grid-template-columns:minmax(0,1fr) 52px 48px 54px 64px 62px;column-gap:6px;align-items:center;}
        .wtbl .gA.head{padding:2px 3px 7px;border-bottom:1px solid var(--border2);}
        .wtbl .gA.head span{font-family:var(--d);font-size:9px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--faint);}
        .wtbl .gA.head .r{text-align:right;} .wtbl .gA.head .c{text-align:center;}
        .wtbl .gA.row{padding:7px 3px;border-bottom:1px solid var(--border);}
        .wtbl .c-point{display:flex;align-items:center;gap:6px;min-width:0;}
        .wtbl .dot{width:7px;height:7px;border-radius:50%;flex:none;}
        .wtbl .ic{width:13px;height:13px;display:inline-block;flex:none;}
        .wtbl .nm{font-family:var(--d);font-weight:600;font-size:12px;background:transparent;border:0;outline:none;color:var(--text);width:100%;min-width:0;padding:0;}
        .wtbl .num{display:flex;flex-direction:column;align-items:flex-end;line-height:1.15;min-width:0;}
        .wtbl .big{font-family:var(--d);font-weight:700;font-size:12.5px;background:transparent;border:0;outline:none;color:var(--text);text-align:right;width:100%;padding:0;}
        .wtbl .big.muted{color:var(--muted);}
        .wtbl .sub{font-size:9px;font-weight:600;}
        .wtbl .sub.inter{color:var(--blue);} .wtbl .sub.dp{color:var(--faint);}
        .wtbl .c-bh{display:flex;min-width:0;}
        .wtbl .hr{font-family:var(--d);font-size:11px;font-weight:500;background:transparent;border:0;outline:none;color:var(--text);width:100%;padding:0;}
        .wtbl .hr::placeholder{color:var(--faint);}
        .wtbl .rav-set{display:flex;gap:3px;justify-content:center;}
        .wtbl .rv{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:6px;cursor:pointer;color:var(--faint);border:1px solid transparent;opacity:.35;background:transparent;padding:0;}
        .wtbl .rv .ic{width:12px;height:12px;}
        .wtbl .rv.on{opacity:1;}
        .wtbl .rv.on.sol{color:var(--yellow);background:rgba(251,191,36,.13);}
        .wtbl .rv.on.liq{color:var(--blue);background:rgba(56,189,248,.13);}
        .wtbl .rv.on.base{color:var(--green);background:rgba(74,222,128,.13);}
        .wtbl .c-obj{display:flex;flex-direction:column;align-items:stretch;gap:2px;}
        .wtbl .obj-in{font-family:var(--d);font-weight:600;font-size:12px;width:100%;background:rgba(255,107,53,.08);border:1px solid rgba(255,107,53,.3);color:var(--orange);border-radius:7px;text-align:center;outline:none;padding:4px 2px;}
        .wtbl .obj-in:focus{border-color:var(--orange);background:rgba(255,107,53,.14);}
        .wtbl .marge{font-family:var(--d);font-size:9px;font-weight:600;line-height:1;text-align:center;}
        .wtbl .marge.ok{color:var(--green);} .wtbl .marge.warn{color:var(--yellow);} .wtbl .marge.bad{color:var(--red);}
      `}</style>

      <div className="legend-mini">
        <b>+x,x</b> sous la distance = inter calculé · <b>BH</b> = barrière · marge sous l&apos;objectif
      </div>

      <div className="gA head">
        <span>Point</span><span className="r">Dist</span><span className="r">D+</span>
        <span>BH</span><span className="c">Ravito</span><span className="c">Obj</span>
      </div>

      {waypoints.map((w, i) => {
        const seg = deriveSegment(segInputs, i)
        const isStart = w.type === 'depart'
        const isEnd = w.type === 'arrivee'
        const isBase = w.supplies.includes('base_vie')
        const lead = isStart ? { dot: 'var(--orange)', icon: 'go' as const, color: 'var(--orange)' }
          : isEnd ? { dot: 'var(--orange)', icon: 'flag' as const, color: 'var(--orange)' }
          : isBase ? { dot: 'var(--green)', icon: 'base' as const, color: 'var(--green)' }
          : { dot: 'var(--muted)', icon: null, color: null }

        const elapsedSec = elapsed ? elapsed[i] : null
        const objStr = elapsedSec != null ? formatElapsedShort(elapsedSec) : ''
        const isOverride = w.targetOverrideSec != null
        const margin = elapsedSec != null ? marginToBarrier(startTime, elapsedSec, w.cutoffRaw, w.cutoffKind) : null

        return (
          <div className="gA row" key={`${w.orderIndex}-${i}`}>
            {/* Point */}
            <div className="c-point">
              <span className="dot" style={{ background: lead.dot }} />
              {lead.icon && <span className="ic" style={{ color: lead.color! }}><Icon name={lead.icon} /></span>}
              <input className="nm" type="text" value={w.name} disabled={readOnly}
                onChange={(e) => update(i, { name: e.target.value })} />
            </div>

            {/* Dist : km cumulé + inter */}
            <div className="num">
              <input className="big" type="text" inputMode="decimal" value={fmtKm(w.km)} disabled={readOnly}
                onChange={(e) => update(i, { km: parseFloat(e.target.value.replace(',', '.')) || 0 })} />
              {seg.interKm != null && <span className="sub inter">+{fmtKm(seg.interKm)}</span>}
            </div>

            {/* D+ : cumul + segment */}
            <div className="num">
              <input className="big muted" type="text" inputMode="numeric" value={w.dPlus ?? ''} disabled={readOnly}
                onChange={(e) => update(i, { dPlus: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
              {seg.dPlusSeg != null && <span className="sub dp">+{seg.dPlusSeg}</span>}
            </div>

            {/* Barrière */}
            <div className="c-bh">
              <input className="hr" type="text" placeholder="—" value={w.cutoffRaw ?? ''} disabled={readOnly}
                onChange={(e) => {
                  const v = e.target.value || null
                  update(i, { cutoffRaw: v, cutoffKind: v === null ? null : w.cutoffKind ?? 'clock_time' })
                }} />
            </div>

            {/* Ravito */}
            <div className="rav-set">
              {SUPPLIES.map((s) => {
                const on = w.supplies.includes(s.val)
                return (
                  <button key={s.cls} type="button" disabled={readOnly} aria-pressed={on}
                    className={`rv ${s.cls}${on ? ' on' : ''}`} onClick={() => toggleSupply(i, s.val)}>
                    <span className="ic"><Icon name={s.icon} /></span>
                  </button>
                )
              })}
            </div>

            {/* Objectif : temps écoulé éditable + marge */}
            <div className="c-obj">
              {!isStart && targetDurationMin != null && (
                <>
                  <input className="obj-in" type="text" inputMode="numeric" placeholder="—" disabled={readOnly}
                    defaultValue={objStr} key={`${objStr}-${isOverride}`}
                    onBlur={(e) => onObjBlur(i, e.target.value)} />
                  {margin && <span className={`marge ${margin.level}`}>{formatMargin(margin.sec)}</span>}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
