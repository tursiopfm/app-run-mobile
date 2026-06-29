'use client'

// Carte « Profil de course » pour l'export (PDF / image / partage). Présentation
// PURE et déterministe (SVG, pas Recharts). Charte identique à la carte tableau.
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { Race, RaceWaypoint, WaypointSupply } from '@/types/plan'
import type { ProfileInfoConfig } from '@/lib/plan/print-profile-info'
import { detectMainClimbs } from '@/lib/plan/main-climbs'
import { buildProfileData, elevationDomain } from '@/components/plan/ElevationProfileChart'
import { deriveSegment, formatElapsedToClock, formatBarrierClock } from '@/lib/plan/waypoint-view'
import { resolveElapsed } from '@/lib/plan/barrier-lock'
import { SUPPLY_ORDER } from '@/lib/plan/supply-chips'
import { xOf, yOf, buildLinePath, buildAreaPath, type ProfileGeom } from '@/lib/plan/profile-print-geometry'

const SUP: Record<WaypointSupply, { letter: string; cls: string }> = {
  liquid: { letter: 'L', cls: 'liq' }, solid: { letter: 'S', cls: 'sol' },
  hot: { letter: 'C', cls: 'hot' }, base_vie: { letter: 'BV', cls: 'base' },
  assistance: { letter: 'A', cls: 'ass' },
}
const SUP_COLOR: Record<string, string> = {
  liq: '#2E90D0', sol: '#B45309', hot: '#DC2626', base: '#16A34A', ass: '#7C5CFC',
}
const fmtKm = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',')
const pad = (n: number) => String(n).padStart(2, '0')
const noDay = (s: string | null | undefined) => (s ? s.replace(/^J\d+\s+/, '') : null)

// Couleur d'accent (bandeau + point) selon le ravito dominant.
function accentOf(w: RaceWaypoint, isEnd: boolean): string {
  if (isEnd) return '#FF7900'
  if (w.supplies.includes('base_vie')) return SUP_COLOR.base
  if (w.supplies.includes('hot') || w.supplies.includes('solid')) return SUP_COLOR.sol
  if (w.supplies.includes('liquid')) return SUP_COLOR.liq
  return '#8A938F'
}

export function ProfilePrintCard({ race, waypoints, denseProfile, info }: {
  race: Race; waypoints: RaceWaypoint[]; denseProfile?: { d: number[]; e: number[] }; info: ProfileInfoConfig
}) {
  // Trace : dense GPX si ≥ 2 points, sinon escalier reconstruit des waypoints.
  const profile = useMemo(() => {
    if (denseProfile && denseProfile.d.length >= 2) return denseProfile
    const { points } = buildProfileData(
      waypoints.map((w) => ({ km: w.km, name: w.name, altitude: w.altitude, dPlus: w.dPlus, dMoins: w.dMoins, supplies: w.supplies, cutoffRaw: w.cutoffRaw })),
    )
    const d: number[] = [], e: number[] = []
    for (const p of points) if (p.alt != null) { d.push(p.km); e.push(p.alt) }
    return { d, e }
  }, [denseProfile, waypoints])

  const elapsed = useMemo(() => resolveElapsed(
    waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec, cutoffRaw: w.cutoffRaw, cutoffKind: w.cutoffKind })),
    race.startTime, race.targetDurationMin ?? null, race.pacingFade ?? 0,
  ).elapsed, [waypoints, race.startTime, race.targetDurationMin, race.pacingFade])

  const climbs = useMemo(
    () => (info.climbs && profile.d.length >= 2 ? detectMainClimbs(profile) : []),
    [info.climbs, profile],
  )

  // Géométrie fixe (design ~180 mm de large → 948×250 px pour le plot).
  const [yMin, yMax] = profile.e.length ? elevationDomain(profile.e) : [0, 100]
  const maxKm = Math.max(profile.d[profile.d.length - 1] ?? 0, ...waypoints.map((w) => w.km), 1)
  const g: ProfileGeom = { W: 948, H: 230, padL: 46, padR: 14, plotTop: 14, plotH: 176, yMin, yMax, maxKm }
  const baseY = g.plotTop + g.plotH
  const pct = (x: number) => (x / g.W) * 100

  const interp = (km: number): number => {
    const { d, e } = profile
    if (d.length === 0) return yMin
    if (km <= d[0]) return e[0]
    if (km >= d[d.length - 1]) return e[e.length - 1]
    for (let i = 1; i < d.length; i++) if (d[i] >= km) {
      const t = (km - d[i - 1]) / ((d[i] - d[i - 1]) || 1)
      return e[i - 1] + (e[i] - e[i - 1]) * t
    }
    return e[e.length - 1]
  }

  const goal = race.targetDurationMin != null
    ? `${Math.floor(race.targetDurationMin / 60)} h ${pad(race.targetDurationMin % 60)}` : null
  const startClock = race.startTime ? noDay(formatElapsedToClock(race.startTime, 0)?.label) : null
  const arrClock = race.startTime && race.targetDurationMin != null
    ? noDay(formatElapsedToClock(race.startTime, race.targetDurationMin * 60)?.label) : null

  const gridAlts: number[] = []
  for (let a = Math.ceil(yMin / 200) * 200; a <= yMax; a += 200) gridAlts.push(a)
  const gridKms: number[] = []
  for (let k = 0; k <= maxKm; k += Math.max(5, Math.round(maxKm / 10 / 5) * 5)) gridKms.push(k)

  return (
    <div className="pcard">
      <style>{`
        .pcard{--ink:#0E1513;--ink-soft:#55615E;--ink-faint:#8A938F;--line:#C9D1CE;--line-strong:#2A332F;--brand:#FF7900;--blue:#2E90D0;--d:'Space Grotesk',var(--font-display,system-ui),sans-serif;background:#fff;color:var(--ink);width:100%;max-width:280mm;margin:0 auto;border-radius:2.5mm;padding:10px 12px 9px;box-shadow:0 18px 40px -16px rgba(0,0,0,.5);font-family:system-ui,sans-serif;}
        .pcard .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.6px solid var(--line-strong);padding-bottom:5px;gap:10px;}
        .pcard .race{font-family:var(--d);font-size:15px;font-weight:700;letter-spacing:-.3px;line-height:1.05;}
        .pcard .stats{font-family:var(--d);font-size:9.5px;color:var(--ink-soft);font-weight:600;margin-top:2px;}
        .pcard .stats b{color:var(--ink);}
        .pcard .brand{font-family:var(--d);font-weight:800;font-size:12px;letter-spacing:.5px;align-self:center;white-space:nowrap;}
        .pcard .brand .b1{color:var(--brand);}.pcard .brand .b2{color:var(--ink-soft);}.pcard .brand .b3{color:var(--brand);}
        .pcard .goal{font-family:var(--d);text-align:right;white-space:nowrap;}
        .pcard .goal .lbl{display:block;color:var(--ink-faint);font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;}
        .pcard .goal .val{color:var(--brand);font-size:14px;font-weight:700;}
        .pcard .plot{position:relative;width:100%;margin-top:5px;}
        .pcard .plot svg{display:block;width:100%;height:auto;}
        .pcard .pin{position:absolute;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;}
        .pcard .pin .chips{display:flex;gap:2px;}
        .pcard .pin .alt{font-family:var(--d);font-weight:700;font-size:9px;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:4px;padding:0 3px;}
        .pcard .chip{font-family:var(--d);font-weight:700;font-size:8.5px;min-width:12px;height:12px;padding:0 2.5px;display:inline-flex;align-items:center;justify-content:center;border-radius:3px;color:#fff;line-height:1;}
        .pcard .chip.liq{background:#2E90D0;}.pcard .chip.sol{background:#B45309;}.pcard .chip.hot{background:#DC2626;}.pcard .chip.base{background:#16A34A;}.pcard .chip.ass{background:#7C5CFC;}
        .pcard .climb{position:absolute;transform:translate(-50%,-50%);background:#fff;border:1px solid var(--brand);color:var(--brand);font-family:var(--d);font-weight:700;font-size:9px;padding:1.5px 5px;border-radius:20px;white-space:nowrap;}
        .pcard .rail{display:grid;margin-top:6px;}
        .pcard .rail .col{padding:0 4px 4px;border-left:1px dashed var(--line);text-align:center;background:#FBFCFC;min-width:0;overflow:hidden;}
        .pcard .rail .col:first-child{border-left:0;}
        .pcard .rail .acc{height:3.5px;border-radius:0 0 3px 3px;margin:0 6px 5px;}
        .pcard .rail .nm{font-family:var(--d);font-weight:700;font-size:9.5px;color:var(--ink);line-height:1.05;min-height:21px;display:flex;align-items:center;justify-content:center;overflow-wrap:anywhere;}
        .pcard .rail .col.is-key .nm{color:var(--brand);}
        .pcard .rail .ka{font-family:var(--d);font-size:8.5px;color:var(--ink-soft);font-weight:600;margin:1px 0 3px;overflow-wrap:anywhere;}
        .pcard .rail .seg{font-family:var(--d);font-size:9px;font-weight:700;color:var(--ink);overflow-wrap:anywhere;}
        .pcard .rail .seg .up{color:var(--brand);}.pcard .rail .seg .dn{color:var(--ink-soft);}
        .pcard .rail .obj{font-family:var(--d);font-size:11px;font-weight:700;color:var(--brand);margin-top:2px;}
        .pcard .rail .bar{font-family:var(--d);font-size:8.5px;font-weight:700;color:#fff;background:#DC2626;border-radius:3px;padding:1px 4px;margin-top:2px;display:inline-block;}
        .pcard .rail .railchips{display:inline-flex;gap:2px;margin-top:2px;}
        .pcard .legend{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:6px;padding-top:5px;border-top:1px solid var(--line-strong);font-family:var(--d);font-size:8.5px;color:var(--ink-soft);font-weight:600;}
        .pcard .legend .k{display:inline-flex;align-items:center;gap:3px;}
      `}</style>

      <div className="hd">
        <div>
          <div className="race">{race.name}</div>
          <div className="stats">
            <b>{race.distance} km</b> · <b>{race.elevation} D+</b> · {waypoints.length} pts
            {startClock ? <> · Dép. <b>{startClock}</b></> : null}
            {arrClock ? <> · Arr. visée <b>{arrClock}</b></> : null}
          </div>
        </div>
        <div className="brand"><span className="b1">TRAIL</span> <span className="b2">COCKPIT</span><span className="b3">.RUN</span></div>
        {goal ? <div className="goal"><span className="lbl">Objectif</span><span className="val">{goal}</span></div> : null}
      </div>

      <div className="plot" style={{ height: g.H }}>
        <svg viewBox={`0 0 ${g.W} ${g.H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' } as CSSProperties}>
          <defs>
            <linearGradient id="pfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2E90D0" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#2E90D0" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          {gridAlts.map((a) => (
            <g key={`ga${a}`}>
              <line x1={g.padL} y1={yOf(g, a)} x2={g.W - g.padR} y2={yOf(g, a)} stroke="#C9D1CE" strokeDasharray="2 3" strokeWidth={1} />
              {info.altitudes && <text x={g.padL - 4} y={yOf(g, a) + 3} textAnchor="end" fontSize={9} fill="#8A938F" fontFamily="Space Grotesk,sans-serif">{a} m</text>}
            </g>
          ))}
          {gridKms.map((k) => (
            <text key={`gk${k}`} x={xOf(g, k)} y={baseY + 13} textAnchor="middle" fontSize={9} fill="#8A938F" fontFamily="Space Grotesk,sans-serif">km {k}</text>
          ))}
          {profile.d.length >= 2 && <path d={buildAreaPath(g, profile)} fill="url(#pfill)" />}
          {profile.d.length >= 2 && <path d={buildLinePath(g, profile)} fill="none" stroke="#2E90D0" strokeWidth={2.2} />}
          {waypoints.map((w, i) => {
            const isEnd = i === waypoints.length - 1, isStart = i === 0
            const acc = accentOf(w, isEnd || isStart)
            const y = interp(w.km)
            return (
              <g key={w.id ?? i}>
                <line x1={xOf(g, w.km)} y1={y} x2={xOf(g, w.km)} y2={baseY} stroke={acc} strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.55} />
                <circle cx={xOf(g, w.km)} cy={y} r={4.5} fill={acc} stroke="#fff" strokeWidth={1.6} />
              </g>
            )
          })}
        </svg>

        {/* pastilles altitude + puces ravito sur la courbe */}
        {waypoints.map((w, i) => {
          const isEnd = i === waypoints.length - 1, isStart = i === 0
          const acc = accentOf(w, isEnd || isStart)
          const chips = info.supplies ? SUPPLY_ORDER.filter((s) => w.supplies.includes(s)) : []
          const y = interp(w.km)
          if (chips.length === 0 && !info.altitudes) return null
          return (
            <div key={`pin${w.id ?? i}`} className="pin" style={{ left: `${pct(xOf(g, w.km))}%`, top: Math.max(2, y - 34) }}>
              {chips.length > 0 && <div className="chips">{chips.map((s) => <span key={s} className={`chip ${SUP[s].cls}`}>{SUP[s].letter}</span>)}</div>}
              {info.altitudes && <div className="alt" style={{ borderColor: acc }}>{Math.round(interp(w.km))} m</div>}
            </div>
          )
        })}

        {/* badges montées principales */}
        {climbs.map((c, i) => (
          <div key={`cl${i}`} className="climb" style={{ left: `${pct(xOf(g, c.midKm))}%`, top: yOf(g, interp(c.midKm)) - 12 }} data-testid="climb">
            ▲ +{c.dPlus} D+ · {Math.round(c.gradientPct)}%
          </div>
        ))}
      </div>

      <div className="rail" style={{ gridTemplateColumns: `repeat(${waypoints.length}, minmax(0, 1fr))` }}>
        {waypoints.map((w, i) => {
          const isEnd = i === waypoints.length - 1, isStart = i === 0
          const acc = accentOf(w, isEnd || isStart)
          const seg = deriveSegment(waypoints.map((x) => ({ km: x.km, dPlus: x.dPlus, dMoins: x.dMoins })), i)
          const objClock = elapsed && race.startTime ? noDay(formatElapsedToClock(race.startTime, elapsed[i])?.label) : null
          const bhRaw = formatBarrierClock(race.startTime, w.cutoffRaw, w.cutoffKind, elapsed?.[i] ?? 0)
          const bh = bhRaw ? bhRaw.replace(/^J\d+\s+/, '') : null
          const chips = info.supplies ? SUPPLY_ORDER.filter((s) => w.supplies.includes(s)) : []
          return (
            <div key={`col${w.id ?? i}`} className={`col${w.supplies.length || isStart || isEnd ? ' is-key' : ''}`}>
              <div className="acc" style={{ background: acc }} />
              <div className="nm">{w.name}</div>
              <div className="ka">km {fmtKm(w.km)}{info.altitudes ? ` · ${Math.round(interp(w.km))} m` : ''}</div>
              <div className="seg">{i === 0
                ? <span className="dn">départ</span>
                : <>{seg.interKm != null ? `${fmtKm(seg.interKm)} km · ` : ''}<span className="up">▲{seg.dPlusSeg ?? 0}</span> <span className="dn">▼{seg.dMoinsSeg ?? 0}</span></>}</div>
              {info.objectif && objClock && <div className="obj" data-testid="obj">{objClock}</div>}
              {info.barriers && bh && <span className="bar" data-testid="barrier">⛔ {bh}</span>}
              {chips.length > 0 && <span className="railchips">{chips.map((s) => <span key={s} className={`chip ${SUP[s].cls}`}>{SUP[s].letter}</span>)}</span>}
            </div>
          )
        })}
      </div>

      <div className="legend">
        {info.supplies && <>
          <span className="k"><span className="chip liq">L</span>liquide</span>
          <span className="k"><span className="chip sol">S</span>solide</span>
          <span className="k"><span className="chip hot">C</span>chaud</span>
          <span className="k"><span className="chip base">BV</span>base vie</span>
          <span className="k"><span className="chip ass">A</span>assistance</span>
        </>}
        {info.climbs && <span className="k"><span style={{ color: 'var(--brand)', fontWeight: 700 }}>▲</span> montée principale</span>}
        <span className="k" style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>Obj = heure visée · Barrière = limite</span>
      </div>
    </div>
  )
}
