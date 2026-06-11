'use client'

// Tableau éditable des points de passage — design « Option A · Compact »
// (cf. Prompts/tableau-course-mockup-optionA.html) : grille fixe (zéro scroll X),
// ravito en icônes, dist+inter et cumul+segment empilés, objectif = temps écoulé
// éditable + marge colorée avant barrière. Colonnes auto via lib/plan/waypoint-view,
// heures via lib/plan/pacing. Pas d'undo (re-import pour reset).
import { useCallback, useMemo, useState } from 'react'
import type { RaceWaypoint, WaypointSupply } from '@/types/plan'
import {
  deriveSegment, formatElapsedShort, parseElapsedShort, formatMargin,
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

const SUPPLY_CAT: { val: WaypointSupply; letter: string; label: string; cls: string }[] = [
  { val: 'liquid',     letter: 'L',  label: 'Liquide',    cls: 'liq'  },
  { val: 'solid',      letter: 'S',  label: 'Solide',     cls: 'sol'  },
  { val: 'hot',        letter: 'C',  label: 'Chaud',      cls: 'hot'  },
  { val: 'base_vie',   letter: 'BV', label: 'Base vie',   cls: 'base' },
  { val: 'assistance', letter: 'A',  label: 'Assistance', cls: 'ass'  },
]

// Catégories actives d'un waypoint, dans l'ordre canonique.
export const activeSupplies = (supplies: WaypointSupply[]) =>
  SUPPLY_CAT.filter((c) => supplies.includes(c.val))

const fmtKm = (n: number) => String(n).replace('.', ',')

// Barrière nettoyée : '21:47' depuis 'ven. 21:47' / '26-22:30' / 'J2 22:30'
// (on retire tout préfixe — jour ou date — devant l'heure).
const barrierClock = (raw: string | null | undefined): string => {
  if (!raw) return '—'
  const m = /(\d{1,2})[:h](\d{2})/.exec(raw)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : raw
}

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

  const [editRow, setEditRow] = useState<number | null>(null)

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
          /* couleurs liées au thème de l'app (lisible en clair ET sombre) */
          --text:var(--trail-text);--muted:var(--trail-muted);--faint:var(--trail-muted);
          --border:var(--trail-border);--border2:var(--trail-border);
          --orange:var(--trail-primary);--blue:#2E90D0;--green:#16A34A;--yellow:#B45309;--red:#DC2626;
          --d:'Space Grotesk',var(--font-display,system-ui),sans-serif;color:var(--text);
        }
        .wtbl .legend-mini{font-size:9.5px;color:var(--faint);padding:0 3px 8px;line-height:1.5;}
        .wtbl .legend-mini b{color:var(--blue);font-weight:600;}
        .wtbl .legend-mini .bhk{color:var(--faint);font-weight:600;}
        .wtbl .legend-mini .lg{display:inline-flex;align-items:center;gap:3px;margin-right:7px;white-space:nowrap;}
        /* Colonnes numériques resserrées (un D+ tient dans 32px) + gap réduit pour
           laisser une largeur LISIBLE à POINT sur téléphone (~360px) — sinon le nom
           se casse caractère par caractère. */
        .wtbl .gA{display:grid;grid-template-columns:minmax(0,1fr) 40px 32px 32px 34px 54px 48px;column-gap:4px;align-items:center;}
        .wtbl .gA.head{padding:2px 3px 7px;border-bottom:1px solid var(--border2);}
        .wtbl .gA.head span{font-family:var(--d);font-size:9px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--faint);}
        .wtbl .gA.head .r{text-align:right;} .wtbl .gA.head .c{text-align:center;}
        .wtbl .gA.row{padding:7px 3px;border-bottom:1px solid var(--border);}
        .wtbl .c-point{display:flex;align-items:center;gap:6px;min-width:0;}
        .wtbl .dot{width:7px;height:7px;border-radius:50%;flex:none;}
        .wtbl .ic{width:13px;height:13px;display:inline-block;flex:none;}
        .wtbl .nm{font-family:var(--d);font-weight:600;font-size:11px;color:var(--text);min-width:0;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
        .wtbl .num{display:flex;flex-direction:column;align-items:flex-end;line-height:1.15;min-width:0;}
        .wtbl .big{font-family:var(--d);font-weight:700;font-size:12.5px;background:transparent;border:0;outline:none;color:var(--text);text-align:right;width:100%;padding:0;}
        .wtbl .big.muted{color:var(--muted);}
        .wtbl .sub{font-size:9px;font-weight:600;}
        .wtbl .sub.inter{color:var(--blue);} .wtbl .sub.dp{color:var(--faint);}
        .wtbl .c-bh{display:flex;justify-content:flex-end;min-width:0;}
        .wtbl .hr{font-family:var(--d);font-size:11px;font-weight:500;color:var(--text);text-align:right;white-space:nowrap;}
        .wtbl .c-rav{position:relative;display:flex;justify-content:center;}
        .wtbl .rav-cell{display:flex;flex-wrap:wrap;gap:2px;justify-content:center;align-items:center;background:none;border:0;padding:2px;min-height:22px;cursor:pointer;}
        .wtbl .rav-cell:disabled{cursor:default;}
        .wtbl .rav-empty{color:var(--faint);font-size:12px;font-weight:600;}
        .wtbl .chip{font-family:var(--d);font-weight:700;font-size:8.5px;min-width:13px;height:13px;padding:0 2px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;color:#fff;line-height:1;}
        .wtbl .chip.liq{background:var(--blue);} .wtbl .chip.sol{background:var(--yellow);}
        .wtbl .chip.hot{background:var(--red);} .wtbl .chip.base{background:var(--green);}
        .wtbl .chip.ass{background:#7C5CFC;}
        .wtbl .rav-backdrop{position:fixed;inset:0;z-index:40;}
        .wtbl .rav-pop{position:absolute;top:100%;right:0;z-index:41;margin-top:2px;background:var(--trail-surface);border:1px solid var(--trail-border);border-radius:10px;padding:4px;display:flex;flex-direction:column;gap:2px;min-width:128px;box-shadow:0 8px 24px rgba(0,0,0,.3);}
        .wtbl .rav-opt{display:flex;align-items:center;gap:7px;background:none;border:0;color:var(--text);font-family:var(--d);font-size:11px;font-weight:600;padding:5px 6px;border-radius:7px;cursor:pointer;text-align:left;opacity:.45;}
        .wtbl .rav-opt.on{opacity:1;background:rgba(127,127,127,.12);}
        .wtbl .c-obj{display:flex;flex-direction:column;align-items:stretch;gap:2px;}
        .wtbl .obj-in{font-family:var(--d);font-weight:600;font-size:12px;width:100%;background:rgba(255,107,53,.08);border:1px solid rgba(255,107,53,.3);color:var(--orange);border-radius:7px;text-align:center;outline:none;padding:4px 2px;}
        .wtbl .obj-in:focus{border-color:var(--orange);background:rgba(255,107,53,.14);}
        .wtbl .segt{font-family:var(--d);font-size:9px;font-weight:600;line-height:1;text-align:center;color:var(--muted);}
      `}</style>

      <div className="legend-mini">
        <b>+x</b> sous Dist · D+ · D− = l&apos;intermédiaire (depuis le point précédent) · <span className="bhk">BH</span> = barrière
        <br />ravitos : <span className="lg"><span className="chip liq">L</span>liquide</span><span className="lg"><span className="chip sol">S</span>solide</span><span className="lg"><span className="chip hot">C</span>chaud</span><span className="lg"><span className="chip base">BV</span>base vie</span><span className="lg"><span className="chip ass">A</span>assistance</span>
      </div>

      <div className="gA head">
        <span>Point</span><span className="r">Dist</span><span className="r">D+</span>
        <span className="r">D-</span>
        <span className="r">BH</span><span className="c">Ravito</span><span className="c">Obj</span>
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
        // Temps du tronçon arrivant à ce point (= obj[i] − obj[i−1]).
        const segSec = elapsed && i > 0 ? elapsed[i] - elapsed[i - 1] : null

        return (
          <div className="gA row" key={`${w.orderIndex}-${i}`}>
            {/* Point */}
            <div className="c-point">
              <span className="dot" style={{ background: lead.dot }} />
              {lead.icon && <span className="ic" style={{ color: lead.color! }}><Icon name={lead.icon} /></span>}
              <span className="nm">{w.name}</span>
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

            {/* D- : cumul + segment (miroir du D+) */}
            <div className="num">
              <input className="big muted" type="text" inputMode="numeric" value={w.dMoins ?? ''} disabled={readOnly}
                onChange={(e) => update(i, { dMoins: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
              {seg.dMoinsSeg != null && <span className="sub dp">+{seg.dMoinsSeg}</span>}
            </div>

            {/* Barrière — départ en haut ; sinon heure nettoyée (préfixe jour retiré) */}
            <div className="c-bh">
              {i === 0 ? (
                <span className="hr">{startTime ? startTime.slice(0, 5) : '—'}</span>
              ) : (
                <span className="hr">{barrierClock(w.cutoffRaw)}</span>
              )}
            </div>

            {/* Ravito : pastilles auto-remplies + édition au tap */}
            <div className="c-rav">
              <button type="button" className="rav-cell" disabled={readOnly}
                aria-label="Modifier les ravitos"
                onClick={() => setEditRow(editRow === i ? null : i)}>
                {activeSupplies(w.supplies).length === 0
                  ? <span className="rav-empty">{readOnly ? '–' : '+'}</span>
                  : activeSupplies(w.supplies).map((c) => (
                      <span key={c.val} className={`chip ${c.cls}`}>{c.letter}</span>
                    ))}
              </button>
              {editRow === i && !readOnly && (
                <>
                  <div className="rav-backdrop" onClick={() => setEditRow(null)} />
                  <div className="rav-pop">
                    {SUPPLY_CAT.map((c) => {
                      const on = w.supplies.includes(c.val)
                      return (
                        <button key={c.val} type="button" className={`rav-opt${on ? ' on' : ''}`}
                          onClick={() => toggleSupply(i, c.val)}>
                          <span className={`chip ${c.cls}`}>{c.letter}</span>{c.label}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Objectif : temps écoulé éditable + marge */}
            <div className="c-obj">
              {!isStart && targetDurationMin != null && (
                <>
                  <input className="obj-in" type="text" inputMode="numeric" placeholder="—" disabled={readOnly}
                    defaultValue={objStr} key={`${objStr}-${isOverride}`}
                    onBlur={(e) => onObjBlur(i, e.target.value)} />
                  {segSec != null && <span className="segt">{formatMargin(segSec).replace('+', '')}</span>}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
