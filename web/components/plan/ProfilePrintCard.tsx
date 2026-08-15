'use client'

// Carte « Profil de course » pour l'export (PDF / image / partage). Présentation
// PURE et déterministe : TOUT est dessiné dans le SVG (pas d'overlay HTML
// position:absolute, qui décroche à l'impression). Charte identique au tableau.
//
// Mise en page (option B) :
//  - bande HAUTE : puces ravito (règle « graphe » chartChips) · objectif horaire
//    (orange) · barrière (drapeau rouge), étalée sur 2 niveaux si trop proches
//  - courbe + noms de points à la VERTICALE sur la courbe
//  - bande BASSE : cotation par tronçon (distance · ▲ D+ orange AU-DESSUS du
//    ▼ D− gris), avec déclutter (libellé masqué si tronçon trop étroit).
import { useMemo } from 'react'
import type { Race, RaceWaypoint, WaypointSupply } from '@/types/plan'
import type { ProfileInfoConfig } from '@/lib/plan/print-profile-info'
import { buildProfileData, elevationDomain } from '@/components/plan/ElevationProfileChart'
import { deriveSegment, formatElapsedToClock, formatBarrierClock } from '@/lib/plan/waypoint-view'
import { resolveElapsed } from '@/lib/plan/barrier-lock'
import { chartChips } from '@/lib/plan/supply-chips'
import {
  xOf, yOf, buildLinePath, buildAreaPath, assignLevels, altitudeStep, type ProfileGeom,
} from '@/lib/plan/profile-print-geometry'

// Largeur du viewBox. La carte est dimensionnée par sa LARGEUR à l'impression
// (170 mm en iPhone) et le SVG s'y ajuste : resserrer le viewBox agrandit donc
// physiquement TOUT le dessin, texte compris, sans toucher une seule taille de
// police. 1180 → 980 = +20 %. OLD_W sert à conserver la hauteur imprimée :
// la carte doit occuper les mêmes millimètres qu'avant (cf. targetH).
const W = 980
const OLD_W = 1180
const K = OLD_W / W                        // même facteur pour le texte HTML (bandeau, légende)

// Métriques verticales, resserrées pour financer le grossissement à hauteur
// constante : le reste est pris sur le relief (cf. plotH).
const BAR_STEP = 21, BAR_H = 20, BAR_FLAG = 8   // rang / boîte / drapeau de barrière
const OBJ_GAP = 18, OBJ_STEP = 18               // 1re ligne d'objectifs sous les barrières, puis rangs
const CHIP_H = 19, CHIP_GAP_Y = 3, CHIP_STEP = 21
const PLOT_GAP = 4                              // puces → haut du relief
const KM_DY = 24                                // axe km sous les pastilles
const COTE_GAP = 50, COTE_STEP = 52, COTE_TAIL = 32  // cotation : 1er rang, rangs suivants, marge basse

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

  // Géométrie du SVG (échelle UNIFORME, width:100%;height:auto). Bandes réservées :
  // haute (0→plotTop) pour les marqueurs, basse (sous baseY) pour la cotation.
  // plotTop / plotH dépendent du nombre de rangs réellement occupés : ils sont
  // renseignés plus bas, une fois les rangs connus (xOf n'en dépend pas).
  const [yMin, yMax] = profile.e.length ? elevationDomain(profile.e) : [0, 100]
  const maxKm = Math.max(profile.d[profile.d.length - 1] ?? 0, ...waypoints.map((w) => w.km), 1)
  const g: ProfileGeom = { W, H: 0, padL: 54, padR: 22, plotTop: 0, plotH: 0, yMin, yMax, maxKm }
  const BARW = 66                          // largeur du drapeau barrière
  const OBJW = 54                          // largeur estimée d'une heure objectif (étalement)

  const goal = race.targetDurationMin != null
    ? `${Math.floor(race.targetDurationMin / 60)} h ${pad(race.targetDurationMin % 60)}` : null
  const startClock = race.startTime ? noDay(formatElapsedToClock(race.startTime, 0)?.label) : null
  const arrClock = race.startTime && race.targetDurationMin != null
    ? noDay(formatElapsedToClock(race.startTime, race.targetDurationMin * 60)?.label) : null

  const gridKms: number[] = []
  for (let k = 0; k <= maxKm; k += Math.max(5, Math.round(maxKm / 10 / 5) * 5)) gridKms.push(k)

  // Marqueurs par point : puces (règle graphe), objectif, barrière.
  const CHIP_GAP = 3
  const chipWidth = (s: WaypointSupply) => (SUP[s].letter.length > 1 ? 24 : 17)
  const wpMeta = waypoints.map((w, i) => {
    const x = xOf(g, w.km)
    const chips = info.supplies ? chartChips(w.supplies) : []
    const chipW = chips.reduce((a, s) => a + chipWidth(s), 0) + CHIP_GAP * Math.max(0, chips.length - 1)
    const objClock = info.objectif && elapsed && race.startTime
      ? noDay(formatElapsedToClock(race.startTime, elapsed[i])?.label) : null
    const bhRaw = info.barriers ? formatBarrierClock(race.startTime, w.cutoffRaw, w.cutoffKind, elapsed?.[i] ?? 0) : null
    const bh = bhRaw ? bhRaw.replace(/^J\d+\s+/, '') : null
    return { w, i, x, chips, chipW, objClock, bh }
  })
  // Étiquettes trop proches → rangs empilés, autant que nécessaire.
  const levelsOf = (rows: typeof wpMeta, halfW: (m: typeof wpMeta[number]) => number) => {
    const lv = assignLevels(rows.map((m) => ({ left: m.x - halfW(m), right: m.x + halfW(m) })), 4)
    const byIndex: Record<number, number> = {}
    rows.forEach((m, k) => { byIndex[m.i] = lv[k] })
    return { byIndex, rows: lv.length ? Math.max(...lv) + 1 : 0 }
  }
  const bar = levelsOf(wpMeta.filter((m) => m.bh), () => BARW / 2)
  const obj = levelsOf(wpMeta.filter((m) => m.objClock), () => OBJW / 2)
  const chip = levelsOf(wpMeta.filter((m) => m.chips.length), (m) => m.chipW / 2)

  // Bande HAUTE : barrières → objectifs → puces, un rang par niveau occupé. Une
  // info masquée dans le dialogue « Infos » referme sa bande au lieu de la réserver.
  const barZoneEnd = bar.rows ? 2 + bar.rows * BAR_STEP + BAR_FLAG : 0
  const objY = (lv: number) => barZoneEnd + OBJ_GAP + lv * OBJ_STEP
  const objZoneEnd = obj.rows ? objY(obj.rows - 1) : barZoneEnd
  const chipY = (lv: number) => objZoneEnd + CHIP_GAP_Y + lv * CHIP_STEP
  g.plotTop = (chip.rows ? chipY(chip.rows - 1) + CHIP_H : objZoneEnd) + PLOT_GAP

  // Cotation des tronçons : mêmes rangs empilés — chacun a son propre trait de cote.
  const segPts = waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, dMoins: w.dMoins }))
  const segView = waypoints.slice(1).map((_, k) => {
    const i = k + 1
    const seg = deriveSegment(segPts, i)
    const x1 = xOf(g, waypoints[i - 1].km), x2 = xOf(g, waypoints[i].km), mid = (x1 + x2) / 2
    const dp = seg.dPlusSeg ?? 0, dm = seg.dMoinsSeg ?? 0
    const kmLabel = seg.interKm != null ? `${fmtKm(seg.interKm)} km` : ''
    // D+ / D− empilés → largeur = la plus large des trois lignes (km, ▲D+, ▼D−).
    const needed = Math.max(kmLabel.length * 9.0, `▲${dp}`.length * 9.8, `▼${dm}`.length * 9.8)
    return { x1, x2, mid, dp, dm, kmLabel, needed }
  })
  const segLv = assignLevels(segView.map((s) => ({ left: s.mid - s.needed / 2, right: s.mid + s.needed / 2 })), 8)
  const segRows = segLv.length ? Math.max(...segLv) + 1 : 1

  // Hauteur imprimée INCHANGÉE : la carte doit occuper les mêmes millimètres
  // qu'avec l'ancien viewBox (398 unités, 458 dès qu'un 2ᵉ rang de cotation sert).
  // Le texte ayant grossi, c'est le RELIEF qui absorbe la différence (plancher 60).
  const tailH = COTE_GAP + (segRows - 1) * COTE_STEP + COTE_TAIL
  const targetH = Math.round((segRows > 1 ? 458 : 398) * (W / OLD_W))
  g.plotH = Math.max(60, targetH - g.plotTop - tailH)
  const baseY = g.plotTop + g.plotH
  const dotY = baseY + 4                   // pastille du point posée sur la ligne de base (sous le nom)
  const KMY = baseY + KM_DY                // axe km (sous les pastilles)
  const coteY = (lv: number) => baseY + COTE_GAP + lv * COTE_STEP
  const svgH = coteY(segRows - 1) + COTE_TAIL
  g.H = svgH

  const gridAlts: number[] = []
  const altStep = altitudeStep(g.plotH, yMax - yMin || 1, 15)
  for (let a = Math.ceil(yMin / altStep) * altStep; a <= yMax; a += altStep) gridAlts.push(a)

  return (
    <div className="pcard">
      <style>{`
        .pcard{--ink:#0E1513;--ink-soft:#55615E;--ink-faint:#8A938F;--line:#C9D1CE;--line-strong:#2A332F;--brand:#FF7900;--blue:#2E90D0;--d:'Space Grotesk',var(--font-display,system-ui),sans-serif;background:#fff;color:var(--ink);width:100%;max-width:280mm;margin:0 auto;border-radius:2.5mm;padding:10px 12px 9px;box-shadow:0 18px 40px -16px rgba(0,0,0,.5);font-family:system-ui,sans-serif;}
        .pcard .hd{display:grid;grid-template-columns:1fr auto 1fr;align-items:start;border-bottom:1.6px solid var(--line-strong);padding-bottom:5px;gap:10px;}
        /* Bandeau et légende sont du HTML en px : ils ne suivent pas le viewBox,
           on leur applique le MÊME facteur K, sinon ils restent à 4,5–6,8 pt. */
        .pcard .race{font-family:var(--d);font-size:${(9 * K).toFixed(1)}px;font-weight:700;letter-spacing:-.3px;line-height:1.05;}
        .pcard .stats{font-family:var(--d);font-size:${(6 * K).toFixed(1)}px;color:var(--ink-soft);font-weight:600;margin-top:2px;}
        .pcard .stats b{color:var(--ink);}
        .pcard .brand{font-family:var(--d);font-weight:800;font-size:${(8 * K).toFixed(1)}px;letter-spacing:.5px;justify-self:center;white-space:nowrap;}
        .pcard .brand .b1{color:var(--brand);}.pcard .brand .b2{color:var(--ink-soft);}.pcard .brand .b3{color:var(--brand);}
        .pcard .goal{font-family:var(--d);text-align:right;white-space:nowrap;justify-self:end;}
        .pcard .goal .lbl{display:block;color:var(--ink-faint);font-size:${(5.5 * K).toFixed(1)}px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;}
        .pcard .goal .val{color:var(--brand);font-size:${(8 * K).toFixed(1)}px;font-weight:700;}
        .pcard .plot{width:100%;margin-top:5px;}
        .pcard .plot svg{display:block;width:100%;height:auto;}
        .pcard .chip{font-family:var(--d);font-weight:700;font-size:${(6.5 * K).toFixed(1)}px;min-width:${(10 * K).toFixed(1)}px;height:${(11 * K).toFixed(1)}px;padding:0 2px;display:inline-flex;align-items:center;justify-content:center;border-radius:3px;color:#fff;line-height:1;}
        .pcard .chip.liq{background:#2E90D0;}.pcard .chip.sol{background:#B45309;}.pcard .chip.hot{background:#DC2626;}.pcard .chip.base{background:#16A34A;}.pcard .chip.ass{background:#7C5CFC;}
        .pcard .legend{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:5px;padding-top:4px;border-top:1px solid var(--line-strong);font-family:var(--d);font-size:${(6.5 * K).toFixed(1)}px;color:var(--ink-soft);font-weight:600;}
        .pcard .legend .k{display:inline-flex;align-items:center;gap:3px;}
        .pcard .legend .bar{font-family:var(--d);font-weight:800;font-size:${(6.5 * K).toFixed(1)}px;color:#B0111C;background:#fff;border:1.2px solid #E11D2A;border-radius:3px;padding:1px 4px;}
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
        {goal ? <div className="goal"><span className="lbl">Objectif</span><span className="val">{goal}</span></div> : <div />}
      </div>

      <div className="plot">
        <svg viewBox={`0 0 ${g.W} ${svgH}`} width={g.W} height={svgH} preserveAspectRatio="xMidYMid meet">
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
              {info.altitudes && <text x={g.padL - 6} y={yOf(g, a) + 5} textAnchor="end" fontSize={15} fill="#94A3B8" fontFamily="Space Grotesk,sans-serif">{a}</text>}
            </g>
          ))}
          {gridKms.map((k) => (
            <text key={`gk${k}`} x={xOf(g, k)} y={KMY} textAnchor="middle" fontSize={16} fill="#94A3B8" fontFamily="Space Grotesk,sans-serif">{k}</text>
          ))}

          {/* aire + courbe */}
          {profile.d.length >= 2 && <path d={buildAreaPath(g, profile)} fill="url(#pfill)" />}
          {profile.d.length >= 2 && <path d={buildLinePath(g, profile)} fill="none" stroke="#2E6FA0" strokeWidth={2.4} />}

          {/* points + connecteur + nom vertical */}
          {wpMeta.map(({ w, i, x }) => {
            const acc = accentOf(w, i === 0 || i === waypoints.length - 1)
            return (
              <g key={`pt${w.id ?? i}`}>
                {/* repère vertical : de la pastille (bas) jusqu'à la bande haute (puces/objectif/barrière) */}
                <line x1={x} y1={dotY} x2={x} y2={g.plotTop - 2} stroke="#94A3B8" strokeDasharray="2 3" strokeWidth={1} strokeOpacity={0.7} />
                <text x={x + 4.5} y={baseY - 11} fontSize={17} fontWeight={700} fill="#334155" fontFamily="Space Grotesk,sans-serif"
                  transform={`rotate(-90 ${x + 4.5} ${baseY - 11})`} paintOrder="stroke" stroke="#fff" strokeWidth={4} strokeLinejoin="round">{w.name}</text>
                {/* pastille du point posée en bas du profil, sous le nom (plus de collision avec la courbe) */}
                <circle cx={x} cy={dotY} r={6} fill={acc} stroke="#fff" strokeWidth={2} />
              </g>
            )
          })}

          {/* bande HAUTE : barrière (drapeau rouge) · objectif (orange) · puces ravito.
              Marqueurs recadrés dans le viewBox (clampX) : aux extrémités, le dernier
              point débordait et se faisait rogner au bord droit. */}
          {wpMeta.map(({ w, i, x, chips, chipW, objClock, bh }) => {
            const clampX = (left: number, width: number) => Math.min(Math.max(left, 2), g.W - width - 2)
            let x0 = clampX(x - chipW / 2, chipW)
            const chipsY = chipY(chip.byIndex[i] ?? 0)
            const by = 2 + (bar.byIndex[i] ?? 0) * BAR_STEP
            const bx = clampX(x - BARW / 2, BARW)
            return (
              <g key={`top${w.id ?? i}`}>
                {bh && (
                  <g data-testid="barrier">
                    {/* fond blanc + bordure rouge + texte rouge foncé : bien plus lisible que blanc-sur-rouge */}
                    <rect x={bx} y={by} width={BARW} height={BAR_H} rx={4} fill="#fff" stroke={BAR} strokeWidth={2.5} />
                    {/* le drapeau reste sur le point, même si la boîte a été recadrée */}
                    <path d={`M${x} ${by + BAR_H} l-6 ${BAR_FLAG} l6 -3 l6 3 z`} fill={BAR} />
                    <text x={bx + BARW / 2} y={by + BAR_H - 5.5} textAnchor="middle" fontSize={15} fontWeight={800} fill="#B0111C" fontFamily="Space Grotesk,sans-serif">{bh}</text>
                  </g>
                )}
                {objClock && (
                  <text data-testid="obj" x={clampX(x - OBJW / 2, OBJW) + OBJW / 2} y={objY(obj.byIndex[i] ?? 0)}
                    textAnchor="middle" fontSize={17} fontWeight={700} fill="#FF7900" fontFamily="Space Grotesk,sans-serif">{objClock}</text>
                )}
                {chips.map((s) => {
                  const wch = chipWidth(s); const cx = x0; x0 += wch + CHIP_GAP
                  return (
                    <g key={s}>
                      <rect x={cx} y={chipsY} width={wch} height={CHIP_H} rx={3.5} fill={SUP_COLOR[SUP[s].cls]} />
                      <text x={cx + wch / 2} y={chipsY + 14} fontSize={12.5} fontWeight={700} fill="#fff" textAnchor="middle" fontFamily="Space Grotesk,sans-serif">{SUP[s].letter}</text>
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* bande BASSE : cotation des tronçons (distance · ▲ D+ orange AU-DESSUS du ▼ D− gris).
              Autant de rangs que nécessaire pour TOUT afficher sans chevauchement. */}
          {segView.map((s, i) => {
            const cy = coteY(segLv[i])
            const lx1 = s.x1 + 6, lx2 = s.x2 - 6
            return (
              <g key={`seg${i}`}>
                {lx2 > lx1 && (
                  <>
                    <line x1={lx1} y1={cy} x2={lx2} y2={cy} stroke="#64748B" strokeWidth={1.8} />
                    <line x1={lx1} y1={cy - 7} x2={lx1} y2={cy + 7} stroke="#64748B" strokeWidth={1.8} />
                    <line x1={lx2} y1={cy - 7} x2={lx2} y2={cy + 7} stroke="#64748B" strokeWidth={1.8} />
                  </>
                )}
                <text x={s.mid} y={cy - 10} textAnchor="middle" fontSize={17} fontWeight={700} fill="#0E1513" fontFamily="Space Grotesk,sans-serif">{s.kmLabel}</text>
                <text x={s.mid} y={cy + 14} textAnchor="middle" fontSize={18} fontWeight={700} fill="#FF7900" fontFamily="Space Grotesk,sans-serif">{`▲${s.dp}`}</text>
                <text x={s.mid} y={cy + 30} textAnchor="middle" fontSize={18} fontWeight={700} fill="#64748B" fontFamily="Space Grotesk,sans-serif">{`▼${s.dm}`}</text>
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
        {info.barriers && <span className="k"><span className="bar">00:00</span> barrière</span>}
        {info.objectif && <span className="k" style={{ color: '#FF7900', fontWeight: 700 }}>00:00 objectif</span>}
        <span className="k" style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>
          tronçon : distance · <span style={{ color: '#FF7900', fontWeight: 700 }}>▲ D+</span> · <span style={{ color: '#64748B', fontWeight: 700 }}>▼ D−</span>
        </span>
      </div>
    </div>
  )
}
