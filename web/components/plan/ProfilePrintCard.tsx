'use client'

// Carte « Profil de course » pour l'export (PDF / image / partage). Présentation
// PURE et déterministe : TOUT est dessiné dans le SVG (pas d'overlay HTML
// position:absolute, qui décroche à l'impression). Charte identique au tableau.
//
// Mise en page (option B révisée) :
//  - bande HAUTE : pastilles ravito · objectif horaire (orange) · barrière (drapeau rouge)
//  - courbe + noms de points à la VERTICALE sur la courbe
//  - bande BASSE : cotation par tronçon (distance · ▲D+ orange · ▼D− gris),
//    avec déclutter (on masque le libellé d'un tronçon trop étroit, le trait reste).
import { useMemo } from 'react'
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
const BAR = '#E11D2A'
const fmtKm = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',')
const pad = (n: number) => String(n).padStart(2, '0')
const noDay = (s: string | null | undefined) => (s ? s.replace(/^J\d+\s+/, '') : null)

// Couleur d'accent (point + connecteur) selon le ravito dominant.
function accentOf(w: RaceWaypoint, isEdge: boolean): string {
  if (isEdge) return '#FF7900'
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

  // Géométrie du SVG (échelle UNIFORME, width:100%;height:auto). Bandes réservées :
  // haute (0→plotTop) pour les marqueurs, basse (sous baseY) pour la cotation.
  const [yMin, yMax] = profile.e.length ? elevationDomain(profile.e) : [0, 100]
  const maxKm = Math.max(profile.d[profile.d.length - 1] ?? 0, ...waypoints.map((w) => w.km), 1)
  const g: ProfileGeom = { W: 1180, H: 328, padL: 46, padR: 18, plotTop: 96, plotH: 156, yMin, yMax, maxKm }
  const baseY = g.plotTop + g.plotH        // 252
  const KMY = baseY + 15                   // axe km
  const coteY = baseY + 48                 // trait de cote des tronçons

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

  // Cotation des tronçons : déclutter glouton (gauche→droite). Le trait de cote est
  // toujours tracé ; le libellé n'est posé que s'il ne chevauche pas le précédent.
  const segPts = waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, dMoins: w.dMoins }))
  const segView: { x1: number; x2: number; mid: number; dp: number; dm: number; kmLabel: string; show: boolean }[] = []
  let lastRight = -1e9
  for (let i = 1; i < waypoints.length; i++) {
    const seg = deriveSegment(segPts, i)
    const x1 = xOf(g, waypoints[i - 1].km), x2 = xOf(g, waypoints[i].km), mid = (x1 + x2) / 2
    const dp = seg.dPlusSeg ?? 0, dm = seg.dMoinsSeg ?? 0
    const kmLabel = seg.interKm != null ? `${fmtKm(seg.interKm)} km` : ''
    const needed = Math.max(kmLabel.length * 7.2, `▲${dp} ▼${dm}`.length * 7.6)
    let show = false
    if (mid - needed / 2 >= lastRight + 8) { show = true; lastRight = mid + needed / 2 }
    segView.push({ x1, x2, mid, dp, dm, kmLabel, show })
  }

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
        .pcard .plot{width:100%;margin-top:5px;}
        .pcard .plot svg{display:block;width:100%;height:auto;}
        .pcard .chip{font-family:var(--d);font-weight:700;font-size:9.5px;min-width:15px;height:15px;padding:0 3px;display:inline-flex;align-items:center;justify-content:center;border-radius:3px;color:#fff;line-height:1;}
        .pcard .chip.liq{background:#2E90D0;}.pcard .chip.sol{background:#B45309;}.pcard .chip.hot{background:#DC2626;}.pcard .chip.base{background:#16A34A;}.pcard .chip.ass{background:#7C5CFC;}
        .pcard .legend{display:flex;gap:11px;flex-wrap:wrap;align-items:center;margin-top:6px;padding-top:5px;border-top:1px solid var(--line-strong);font-family:var(--d);font-size:10px;color:var(--ink-soft);font-weight:600;}
        .pcard .legend .k{display:inline-flex;align-items:center;gap:4px;}
        .pcard .legend .bar{font-family:var(--d);font-weight:700;font-size:9.5px;color:#fff;background:#E11D2A;border-radius:3px;padding:1px 5px;}
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

      <div className="plot">
        <svg viewBox={`0 0 ${g.W} ${g.H}`}>
          <defs>
            <linearGradient id="pfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2E90D0" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#2E90D0" stopOpacity={0.04} />
            </linearGradient>
          </defs>

          {/* grille altitude + axe */}
          {gridAlts.map((a) => (
            <g key={`ga${a}`}>
              <line x1={g.padL} y1={yOf(g, a)} x2={g.W - g.padR} y2={yOf(g, a)} stroke="#E2E8F0" strokeWidth={1} />
              {info.altitudes && <text x={g.padL - 5} y={yOf(g, a) + 3.5} textAnchor="end" fontSize={10.5} fill="#94A3B8" fontFamily="Space Grotesk,sans-serif">{a}</text>}
            </g>
          ))}
          {gridKms.map((k) => (
            <text key={`gk${k}`} x={xOf(g, k)} y={KMY} textAnchor="middle" fontSize={11} fill="#94A3B8" fontFamily="Space Grotesk,sans-serif">{k}</text>
          ))}

          {/* aire + courbe */}
          {profile.d.length >= 2 && <path d={buildAreaPath(g, profile)} fill="url(#pfill)" />}
          {profile.d.length >= 2 && <path d={buildLinePath(g, profile)} fill="none" stroke="#2E6FA0" strokeWidth={1.9} />}

          {/* points + connecteur + nom vertical */}
          {waypoints.map((w, i) => {
            const isEdge = i === 0 || i === waypoints.length - 1
            const acc = accentOf(w, isEdge)
            const x = xOf(g, w.km), y = interp(w.km)
            return (
              <g key={`pt${w.id ?? i}`}>
                <line x1={x} y1={y} x2={x} y2={g.plotTop - 2} stroke="#94A3B8" strokeDasharray="2 3" strokeWidth={1} strokeOpacity={0.7} />
                <text x={x + 3.5} y={baseY - 7} fontSize={11.5} fontWeight={700} fill="#334155" fontFamily="Space Grotesk,sans-serif"
                  transform={`rotate(-90 ${x + 3.5} ${baseY - 7})`} paintOrder="stroke" stroke="#fff" strokeWidth={3} strokeLinejoin="round">{w.name}</text>
                <circle cx={x} cy={y} r={4.5} fill={acc} stroke="#fff" strokeWidth={1.6} />
              </g>
            )
          })}

          {/* bande HAUTE : pastilles ravito · objectif (orange) · barrière (drapeau rouge) */}
          {waypoints.map((w, i) => {
            const x = xOf(g, w.km)
            const chips = info.supplies ? SUPPLY_ORDER.filter((s) => w.supplies.includes(s)) : []
            const objClock = info.objectif && elapsed && race.startTime ? noDay(formatElapsedToClock(race.startTime, elapsed[i])?.label) : null
            const bhRaw = info.barriers ? formatBarrierClock(race.startTime, w.cutoffRaw, w.cutoffKind, elapsed?.[i] ?? 0) : null
            const bh = bhRaw ? bhRaw.replace(/^J\d+\s+/, '') : null
            // chips
            const chipH = 16, gap = 2.4
            const ws = chips.map((s) => (SUP[s].letter.length > 1 ? 21 : 15))
            const totalW = ws.reduce((a, b) => a + b, 0) + gap * Math.max(0, chips.length - 1)
            let x0 = x - totalW / 2
            const chipsY = g.plotTop - 20
            // barrière
            const bw = 52, bh2 = 19, bx = x - bw / 2, by = 6
            return (
              <g key={`top${w.id ?? i}`}>
                {bh && (
                  <g data-testid="barrier">
                    <rect x={bx} y={by} width={bw} height={bh2} rx={3.5} fill={BAR} />
                    <path d={`M${x} ${by + bh2} l-5 7 l5 -2.5 l5 2.5 z`} fill={BAR} />
                    <text x={x} y={by + 13.6} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="#fff" fontFamily="Space Grotesk,sans-serif">{`⏱ ${bh}`}</text>
                  </g>
                )}
                {objClock && <text data-testid="obj" x={x} y={g.plotTop - 44} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="#FF7900" fontFamily="Space Grotesk,sans-serif">{objClock}</text>}
                {chips.map((s, j) => {
                  const wch = ws[j]; const cx = x0; x0 += wch + gap
                  return (
                    <g key={s}>
                      <rect x={cx} y={chipsY} width={wch} height={chipH} rx={3} fill={SUP_COLOR[SUP[s].cls]} />
                      <text x={cx + wch / 2} y={chipsY + 11.8} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle" fontFamily="Space Grotesk,sans-serif">{SUP[s].letter}</text>
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* montées principales (sur la courbe) */}
          {climbs.map((c, i) => {
            const cx = xOf(g, c.midKm)
            const cy = yOf(g, interp(c.midKm)) - 12
            const label = `▲ +${c.dPlus} D+ · ${Math.round(c.gradientPct)}%`
            const w = label.length * 4.7 + 12
            return (
              <g key={`cl${i}`} data-testid="climb">
                <rect x={cx - w / 2} y={cy - 7} width={w} height={14} rx={7} fill="#fff" stroke="#FF7900" strokeWidth={1} />
                <text x={cx} y={cy + 3.4} fontSize={8} fontWeight={700} fill="#FF7900" textAnchor="middle" fontFamily="Space Grotesk,sans-serif">{label}</text>
              </g>
            )
          })}

          {/* bande BASSE : cotation des tronçons (distance · ▲D+ orange · ▼D− gris) */}
          {segView.map((s, i) => {
            const lx1 = s.x1 + 6, lx2 = s.x2 - 6
            return (
              <g key={`seg${i}`}>
                {lx2 > lx1 && (
                  <>
                    <line x1={lx1} y1={coteY} x2={lx2} y2={coteY} stroke="#64748B" strokeWidth={1.5} />
                    <line x1={lx1} y1={coteY - 5} x2={lx1} y2={coteY + 5} stroke="#64748B" strokeWidth={1.5} />
                    <line x1={lx2} y1={coteY - 5} x2={lx2} y2={coteY + 5} stroke="#64748B" strokeWidth={1.5} />
                  </>
                )}
                {s.show && (
                  <>
                    <text x={s.mid} y={coteY - 9} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0E1513" fontFamily="Space Grotesk,sans-serif">{s.kmLabel}</text>
                    <text x={s.mid} y={coteY + 19} textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="Space Grotesk,sans-serif">
                      <tspan fill="#FF7900">{`▲${s.dp}`}</tspan>
                      <tspan fill="#64748B" dx={9}>{`▼${s.dm}`}</tspan>
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="legend">
        {info.supplies && <>
          <span className="k"><span className="chip liq">L</span>liquide</span>
          <span className="k"><span className="chip sol">S</span>solide</span>
          <span className="k"><span className="chip hot">C</span>chaud</span>
          <span className="k"><span className="chip base">BV</span>base vie</span>
          <span className="k"><span className="chip ass">A</span>assistance</span>
        </>}
        {info.barriers && <span className="k"><span className="bar">⏱ 00:00</span> barrière</span>}
        {info.objectif && <span className="k" style={{ color: '#FF7900', fontWeight: 700 }}>00:00 objectif</span>}
        {info.climbs && <span className="k"><span style={{ color: 'var(--brand)', fontWeight: 700 }}>▲</span> montée principale</span>}
        <span className="k" style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>
          tronçon : distance · <span style={{ color: '#FF7900', fontWeight: 700 }}>▲ D+</span> · <span style={{ color: '#64748B', fontWeight: 700 }}>▼ D−</span>
        </span>
      </div>
    </div>
  )
}
