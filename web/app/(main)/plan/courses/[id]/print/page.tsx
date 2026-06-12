'use client'

// Export PDF — carte de course format iPhone (cf. Prompts/tableau-course-pdf-mockup.html).
// Colonnes personnalisables (choix + ordre) via PrintColumnsDialog, largeurs auto.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Race, RaceWaypoint } from '@/types/plan'
import { getRaces } from '@/lib/plan/storage'
import { estimatePassageTimes } from '@/lib/plan/pacing'
import { deriveSegment, formatElapsedToClock, formatElapsedShort, formatBarrierClock, formatMargin } from '@/lib/plan/waypoint-view'
import {
  loadPrintColConfig, savePrintColConfig, visiblePrintCols,
  PRINT_COL_DEFS, DEFAULT_PRINT_CONFIG, type PrintColConfig, type PrintColKey,
} from '@/lib/plan/print-columns'
import { PrintColumnsDialog } from '@/components/plan/PrintColumnsDialog'
import { toJpeg } from 'html-to-image'
import { FileText, Image as ImageIcon, Share2, Settings2 } from 'lucide-react'

const fmt = (n: number) => String(n).replace('.', ',')
const pad = (n: number) => String(n).padStart(2, '0')

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tableau'

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function PrintCoursePage({ params }: { params: { id: string } }) {
  const [race, setRace] = useState<Race | null>(null)
  const [wps, setWps] = useState<RaceWaypoint[]>([])
  const [ready, setReady] = useState(false)
  const [cfg, setCfg] = useState<PrintColConfig>(DEFAULT_PRINT_CONFIG)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => { setCfg(loadPrintColConfig()) }, [])

  useEffect(() => {
    void (async () => {
      const races = await getRaces()
      setRace(races.find((r) => r.id === params.id) ?? null)
      const res = await fetch(`/api/races/${params.id}/waypoints`)
      if (res.ok) setWps((await res.json()).waypoints ?? [])
      setReady(true)
    })()
  }, [params.id])

  // Pas d'impression auto : l'utilisateur personnalise les colonnes puis clique
  // « Imprimer / PDF » quand il est prêt.

  const updateCfg = (next: PrintColConfig) => { setCfg(next); savePrintColConfig(next) }

  const cardRef = useRef<HTMLDivElement>(null)
  const jpegBtnRef = useRef<HTMLButtonElement>(null)
  const shareBtnRef = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)

  // Rasterise un CLONE de la carte, à plat, hors écran — l'aperçu tourné à
  // l'écran ne bouge pas (pas de flash portrait→paysage pendant la capture).
  const renderJpeg = useCallback(async () => {
    const el = cardRef.current
    if (!el) return null
    await document.fonts?.ready
    const wrap = document.createElement('div')
    wrap.className = 'pdfroot exporting'
    wrap.style.cssText = 'position:fixed;left:-10000px;top:0;padding:0;min-height:0;background:#fff;'
    wrap.appendChild(el.cloneNode(true))
    document.body.appendChild(wrap)
    try {
      const card = wrap.firstElementChild as HTMLElement
      const dataUrl = await toJpeg(card, { backgroundColor: '#ffffff', pixelRatio: 2, quality: 0.95, cacheBust: true })
      const blob = await (await fetch(dataUrl)).blob()
      return { dataUrl, blob }
    } finally {
      wrap.remove()
    }
  }, [])

  const exportJpeg = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await renderJpeg()
      if (r && race) triggerDownload(r.dataUrl, `${slug(race.name)}.jpg`)
    } finally {
      setBusy(false)
    }
  }, [busy, renderJpeg, race])

  const shareJpeg = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await renderJpeg()
      if (!r || !race) return
      const file = new File([r.blob], `${slug(race.name)}.jpg`, { type: 'image/jpeg' })
      const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean }
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: race.name })
      } else {
        triggerDownload(r.dataUrl, `${slug(race.name)}.jpg`)
      }
    } catch {
      // partage annulé par l'utilisateur ou indisponible — silencieux
    } finally {
      setBusy(false)
    }
  }, [busy, renderJpeg, race])

  // ?export= met en avant (focus = liseré blanc) le bouton visé, sans rien
  // déclencher : l'utilisateur personnalise d'abord les colonnes sur l'aperçu.
  useEffect(() => {
    if (!ready || !race) return
    const action = new URLSearchParams(window.location.search).get('export')
    if (action === 'jpeg') jpegBtnRef.current?.focus()
    else if (action === 'share') shareBtnRef.current?.focus()
  }, [ready, race])

  if (!ready) return <div className="p-6 text-sm">Préparation…</div>
  if (!race) return <div className="p-6 text-sm">Course introuvable.</div>

  const totalSec = race.targetDurationMin != null ? race.targetDurationMin * 60 : null
  const elapsed = totalSec != null
    ? estimatePassageTimes(
        wps.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
        { totalDurationSec: totalSec, fade: race.pacingFade ?? 0 },
      )
    : null
  const noDay = (s: string | undefined) => (s ? s.replace(/^J\d+\s+/, '') : null)
  const startClock = race.startTime ? noDay(formatElapsedToClock(race.startTime, 0)?.label) : null
  const arrClock = race.startTime && totalSec != null ? noDay(formatElapsedToClock(race.startTime, totalSec)?.label) : null
  const goal = race.targetDurationMin != null
    ? `${Math.floor(race.targetDurationMin / 60)} h ${pad(race.targetDurationMin % 60)}`
    : null

  const cols = visiblePrintCols(cfg)
  const totalW = cols.reduce((s, k) => s + PRINT_COL_DEFS[k].weight, 0)
  const ta = (k: PrintColKey): 'left' | 'right' | 'center' => {
    const a = PRINT_COL_DEFS[k].align
    return a === 'r' ? 'right' : a === 'c' ? 'center' : 'left'
  }

  const cell = (k: PrintColKey, w: RaceWaypoint, i: number) => {
    const seg = deriveSegment(wps.map((x) => ({ km: x.km, dPlus: x.dPlus, dMoins: x.dMoins })), i)
    // Objectif = chrono depuis le départ (temps écoulé), comme le tableau écran.
    const objLabel = elapsed ? formatElapsedShort(elapsed[i]) : null
    // Barrière = heure d'horloge SANS le préfixe jour (Jx retiré).
    const bhRaw = formatBarrierClock(race.startTime, w.cutoffRaw, w.cutoffKind, elapsed?.[i] ?? 0)
    const bhLabel = bhRaw ? bhRaw.replace(/^J\d+\s+/, '') : null
    // Temps du tronçon arrivant à ce point (obj[i] − obj[i−1]).
    const segt = elapsed && i > 0 ? formatMargin(elapsed[i] - elapsed[i - 1]).replace('+', '') : null
    const dash = <span className="dash">—</span>
    switch (k) {
      case 'point':  return <span className="pt">{w.name}</span>
      case 'km':     return <span className="km">{fmt(w.km)}</span>
      case 'cum':    return <span className="cum">{w.dPlus ?? 0}</span>
      case 'inter':  return <span className="sv">{seg.interKm != null ? fmt(seg.interKm) : dash}</span>
      case 'dplus':  return <span className="sv dp">{seg.dPlusSeg != null ? <><span className="ar">▲</span>{seg.dPlusSeg}</> : dash}</span>
      case 'dmoins': return <span className="sv dm">{seg.dMoinsSeg != null ? <><span className="ar">▼</span>{seg.dMoinsSeg}</> : dash}</span>
      case 'rav':    return (
        <span className="rav">
          {w.supplies.includes('liquid') && <span className="rb liq">L</span>}
          {w.supplies.includes('solid') && <span className="rb sol">S</span>}
          {w.supplies.includes('hot') && <span className="rb hot">C</span>}
          {w.supplies.includes('base_vie') && <span className="rb base">BV</span>}
          {w.supplies.includes('assistance') && <span className="rb ass">A</span>}
        </span>
      )
      case 'obj':    return <span className="obj">{objLabel ?? dash}</span>
      case 'segt':   return <span className="obj">{segt ?? dash}</span>
      case 'bh':     return <span className="bh">{bhLabel ?? dash}</span>
    }
  }

  return (
    <div className="pdfroot">
      <style>{`
        .pdfroot{
          --ink:#0E1513; --ink-soft:#55615E; --ink-faint:#8A938F;
          --line:#C9D1CE; --line-strong:#2A332F; --zebra:#E3EAE8; --accent:#C44E22;
          --d:'Space Grotesk',var(--font-display,system-ui),sans-serif;
          background:var(--trail-bg); min-height:100vh; display:flex; flex-direction:column; align-items:center;
          padding:28px 16px 60px; color:var(--trail-text); font-family:system-ui,sans-serif;
        }
        /* Toolbar en colonne (mobile-first) : titre, 3 boutons d'export égaux, colonnes. */
        .pdfroot .toolbar{display:flex;flex-direction:column;gap:8px;color:var(--trail-text);font-size:13px;margin-bottom:8px;width:120mm;max-width:100%;}
        .pdfroot .toolbar .ttl{font-family:var(--d);font-weight:600;font-size:14px;}
        .pdfroot .toolbar .actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
        .pdfroot .btn{font-family:var(--d);font-weight:600;font-size:13px;padding:10px 8px;border-radius:10px;border:0;background:var(--trail-primary);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;}
        /* Liseré sur le bouton ciblé par ?export= (focus) — contrasté sur les 2 thèmes. */
        .pdfroot .btn:focus{outline:2px solid var(--trail-text);outline-offset:2px;}
        /* « Personnaliser les colonnes » : contour orange (secondaire) — visible en clair ET sombre, distinct des 3 boutons pleins. */
        .pdfroot .btn.ghost{background:transparent;border:1.5px solid var(--trail-primary);color:var(--trail-primary);}
        .pdfroot .caption{width:120mm;max-width:100%;color:var(--trail-muted);font-size:11px;margin-bottom:16px;line-height:1.4;}
        .pdfroot .cut{padding:6mm;border:1px dashed var(--trail-border);border-radius:6px;background:var(--trail-surface);}
        .pdfroot .scis{font-size:10px;color:var(--trail-muted);margin-bottom:4px;display:block;}
        /* wrap = bounding box de la carte TOURNÉE (65×120) ; carte centrée en ABSOLU pour garder 120×65 (sinon le flex la rétrécit → carrée) */
        .pdfroot .cardwrap{width:65mm;height:120mm;position:relative;}
        .pdfroot .card{width:120mm;height:auto;background:#fff;color:var(--ink);border-radius:2.5mm;display:flex;flex-direction:column;overflow:hidden;padding:1.1mm 2mm;box-shadow:0 18px 40px -16px rgba(0,0,0,.6);position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(90deg);}
        .pdfroot .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.4px solid var(--line-strong);padding-bottom:1.5px;flex:none;}
        .pdfroot .race{font-family:var(--d);font-size:9px;font-weight:700;letter-spacing:-.2px;white-space:nowrap;line-height:1.1;}
        .pdfroot .stats{font-family:var(--d);font-size:5.8px;color:var(--ink-soft);font-weight:600;white-space:nowrap;}
        .pdfroot .stats b{color:var(--ink);}
        .pdfroot .goal{font-family:var(--d);font-size:8.5px;color:var(--accent);font-weight:700;white-space:nowrap;}
        .pdfroot .goal .lbl{color:var(--ink-faint);font-size:6px;font-weight:600;}
        /* fixed-layout + colgroup par poids (normalisés sur les colonnes visibles)
           = colonnes harmonisées remplissant la carte, MÊME équilibre quel que soit
           le sous-ensemble choisi. Point borné (~2.4×), data égales ; padding uniforme
           pour des écarts réguliers. Les cellules rognent (overflow) ; le Point passe
           en ellipsis si le nom est trop long.
           Lignes de hauteur NATURELLE (pas de flex:1 qui étirait la 1re ligne/l'en-tête).
           La carte (height:auto) s'ajuste au contenu → aucun vide au-dessus du titre ni
           sous le tableau, quel que soit le nombre de points. */
        .pdfroot table{width:100%;border-collapse:collapse;margin-top:1px;table-layout:fixed;}
        .pdfroot thead th{font-family:var(--d);font-size:9.5px;font-weight:400;letter-spacing:.1px;text-transform:uppercase;color:var(--ink-soft);padding:.1px 4px;border-bottom:1px solid var(--line-strong);line-height:10.5px;vertical-align:middle;white-space:nowrap;overflow:hidden;}
        .pdfroot tbody tr{border-bottom:.5px solid var(--line);}
        .pdfroot tbody tr:nth-child(even){background:var(--zebra);}
        .pdfroot tbody td{padding:.1px 4px;vertical-align:middle;line-height:10.5px;font-size:9.5px;white-space:nowrap;overflow:hidden;}
        .pdfroot .pt{font-family:var(--d);font-size:8.7px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;}
        .pdfroot .km{font-family:var(--d);font-size:9.5px;font-weight:700;}
        .pdfroot .cum{font-family:var(--d);font-size:9.5px;font-weight:700;color:var(--ink);}
        .pdfroot .sv{font-family:var(--d);font-size:9.5px;font-weight:700;white-space:nowrap;}
        .pdfroot .sv.dp .ar{color:var(--accent);font-size:6.5px;}
        .pdfroot .sv.dm{color:var(--ink-soft);} .pdfroot .sv.dm .ar{font-size:6.5px;}
        .pdfroot .dash{color:var(--ink-faint);font-weight:500;}
        .pdfroot .rav{display:inline-flex;gap:1.5px;}
        .pdfroot .rb{font-family:var(--d);font-weight:700;font-size:7px;min-width:10px;height:9px;padding:0 1.5px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:2.5px;color:#fff;line-height:1;}
        .pdfroot .rb.liq{background:#2E90D0;} .pdfroot .rb.sol{background:#B45309;}
        .pdfroot .rb.hot{background:#DC2626;} .pdfroot .rb.base{background:#16A34A;}
        .pdfroot .rb.ass{background:#7C5CFC;}
        .pdfroot .obj{font-family:var(--d);font-size:9.5px;font-weight:700;}
        .pdfroot .bh{font-family:var(--d);font-size:9.5px;font-weight:700;color:var(--ink);white-space:nowrap;}
        .pdfroot tr.is-base td{background:#D5E3DD;}
        .pdfroot tr.is-end .pt,.pdfroot tr.is-start .pt{color:var(--accent);}
        .pdfroot .legend{flex:none;display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:.5px;padding-top:1px;border-top:1px solid var(--line-strong);font-family:var(--d);font-size:5.2px;color:var(--ink-soft);font-weight:600;line-height:1.2;}
        .pdfroot .legend .k{display:inline-flex;align-items:center;gap:3px;}
        .pdfroot .legend .rb{transform:scale(.78);}

        /* Capture image (html-to-image) : appliquée au WRAPPER hors écran qui
           contient le clone de la carte (cf. renderJpeg) — met le clone à plat. */
        .pdfroot.exporting .card{position:static;transform:none;top:auto;left:auto;margin:0 auto;box-shadow:none;}
        .pdfroot .btn:disabled{opacity:.5;cursor:default;}

        @page{size:A4 portrait;margin:8mm;}
        @media print{
          /* UNE page : on annule les min-height de la coquille app (2× min-h-screen,
             sidebar, bottom-nav) qui forceraient une 2e page même en visibility:hidden. */
          html, body { margin:0 !important; padding:0 !important; background:#fff !important; }
          * { min-height:0 !important; }
          body * { visibility:hidden !important; }
          .pdfroot, .pdfroot * { visibility:visible !important; }
          /* Carte à l'HORIZONTALE (non tournée), calée en HAUT de la feuille portrait. */
          .pdfroot{position:absolute !important;top:0;left:0;right:0;width:100% !important;background:#fff;padding:0 !important;display:block !important;}
          .pdfroot .toolbar,.pdfroot .caption,.pdfroot .scis{display:none !important;}
          .pdfroot .cut{border:none;background:none;padding:0;margin:0;width:auto;}
          .pdfroot .cardwrap{position:static !important;width:auto !important;height:auto !important;}
          .pdfroot .card{position:static !important;transform:none !important;top:auto;left:auto;margin:0 auto;box-shadow:none;border:.5px solid var(--line);}
          .pdfroot tbody tr:nth-child(even){background:var(--zebra) !important;}
          .pdfroot tr.is-base td{background:#D5E3DD !important;}
          *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        }
      `}</style>

      <div className="toolbar">
        <span className="ttl">Carte de course</span>
        <div className="actions">
          <button className="btn" onClick={() => window.print()}><FileText size={16} /> PDF</button>
          <button className="btn" ref={jpegBtnRef} onClick={() => void exportJpeg()} disabled={busy}><ImageIcon size={16} /> Image</button>
          <button className="btn" ref={shareBtnRef} onClick={() => void shareJpeg()} disabled={busy}><Share2 size={16} /> Partager</button>
        </div>
        <button className="btn ghost" onClick={() => setDialogOpen(true)}><Settings2 size={16} /> Personnaliser les colonnes</button>
      </div>
      <p className="caption">{"Les colonnes choisies s'appliquent aux trois formats (PDF, image, partage). Aperçu tourné à l'écran (format carte de poche). À l'impression : carte à l'horizontale, en haut de la feuille A4. Découpe, plastifie — tient dans une poche de veste."}</p>

      <div className="cut">
        <span className="scis">✂ — — — — — — — — découper — — — — — — — —</span>

        <div className="cardwrap">
        <div className="card" ref={cardRef}>
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
              {cols.map((k) => (
                <col key={k} style={{ width: `${(PRINT_COL_DEFS[k].weight / totalW) * 100}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {cols.map((k) => (
                  <th key={k} style={{ textAlign: ta(k) }}>
                    {PRINT_COL_DEFS[k].th}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wps.map((w, i) => {
                const rowCls = i === 0 ? 'is-start' : i === wps.length - 1 ? 'is-end' : w.supplies.includes('base_vie') ? 'is-base' : ''
                return (
                  <tr key={w.id} className={rowCls}>
                    {cols.map((k) => (
                      <td key={k} style={{ textAlign: ta(k) }}>
                        {cell(k, w, i)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="legend">
            <span className="k">Inter · ▲D+ · ▼D− = tronçon (depuis pt préc.)</span>
            <span className="k">ΣD+ = cumulé</span>
            <span className="k"><span className="rb liq">L</span>liquide</span>
            <span className="k"><span className="rb sol">S</span>solide</span>
            <span className="k"><span className="rb hot">C</span>chaud</span>
            <span className="k"><span className="rb base">BV</span>base vie</span>
            <span className="k"><span className="rb ass">A</span>assistance</span>
            <span className="k" style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>Obj = heure visée · Barrière = limite</span>
          </div>
        </div>
        </div>
      </div>

      <PrintColumnsDialog open={dialogOpen} config={cfg} onChange={updateCfg} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
