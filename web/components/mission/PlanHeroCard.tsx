'use client'

// Bloc héros « Ta prochaine séance » — 3 états : suggested / done / rest.
// Maquette de référence : Prompts/plan-tab-mission-final-mockup.html (bloc ①).

import { useT } from '@/lib/i18n/I18nProvider'
import type { IntensityLevel } from '@/types/plan'
import { BlockMenu } from '@/components/blocks/BlockMenu'

// ─── helpers durée ───────────────────────────────────────────────────────────

function formatDur(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? (m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`) : `${m} min`
}

function fmtDurSec(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

// ── Profil de séance : barres « allure » + trait « dénivelé » ────────────────
// Adapté au TYPE de séance. Barres : échauffement / retour au calme = vert,
// efforts = orange, récup entre efforts = gris. Trait D+ : aucun (séance plate),
// vagues (vallonné : sortie longue/course), triangles (côtes : montées-descentes).
type BarRole = 'easy' | 'effort' | 'recovery'
const BAR_COLOR: Record<BarRole, string> = { easy: '#4ADE80', effort: '#FF7900', recovery: '#6B7785' }

function sessionBars(type: string): { h: number; role: BarRole }[] {
  const e = (h: number) => ({ h, role: 'easy' as BarRole })
  const x = (h: number) => ({ h, role: 'effort' as BarRole })
  const r = (h: number) => ({ h, role: 'recovery' as BarRole })
  switch (type) {
    case 'fractionne':  return [e(0.3), e(0.4), x(0.92), r(0.35), x(0.92), r(0.35), x(0.92), r(0.35), e(0.3)]
    case 'cotes':       return [e(0.3), e(0.45), x(0.85), r(0.4), x(0.9), r(0.4), x(0.85), r(0.4), e(0.3)]
    case 'seuil_tempo': return [e(0.3), e(0.45), x(0.8), x(0.8), r(0.4), x(0.8), x(0.8), e(0.35)]
    case 'course':      return [e(0.35), x(0.72), x(0.76), x(0.73), x(0.78), x(0.74), x(0.76), e(0.4)]
    default:            return [e(0.4), e(0.5), e(0.55), e(0.52), e(0.55), e(0.5), e(0.52), e(0.45)]
  }
}

type ElevKind = 'none' | 'waves' | 'triangles'
function elevKind(type: string): ElevKind {
  if (type === 'cotes') return 'triangles'
  if (type === 'sortie_longue' || type === 'course') return 'waves'
  return 'none'
}
function elevValues(kind: ElevKind): number[] {
  if (kind === 'waves') return [0.3, 0.5, 0.38, 0.6, 0.45, 0.62, 0.4, 0.55, 0.42, 0.5]
  if (kind === 'triangles') return [0.15, 0.8, 0.25, 0.85, 0.3, 0.82, 0.22, 0.7, 0.2]
  return []
}

// Lissage spline pour les « vagues » du dénivelé vallonné.
function smoothLineFromPts(P: readonly (readonly [number, number])[]): string {
  if (P.length < 2) return ''
  let d = `M ${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] ?? P[i + 1]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

function SessionProfile({ sessionType }: { sessionType: string }) {
  const W = 120, H = 60, PAD = 5
  const bars = sessionBars(sessionType)
  const n = bars.length
  const slot = (W - 2 * PAD) / n
  const barW = slot * 0.6
  const kind = elevKind(sessionType)
  const ev = elevValues(kind)
  const step = ev.length > 1 ? (W - 2 * PAD) / (ev.length - 1) : 0
  const pts = ev.map((v, i) => [PAD + i * step, PAD + (1 - v) * (H - 2 * PAD)] as const)
  const elevPath = kind === 'triangles'
    ? pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    : kind === 'waves' ? smoothLineFromPts(pts) : ''
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full" aria-hidden>
      {bars.map((b, i) => {
        const h = b.h * (H - 2 * PAD)
        const x = PAD + i * slot + (slot - barW) / 2
        return <rect key={i} x={x.toFixed(1)} y={(H - PAD - h).toFixed(1)} width={barW.toFixed(1)} height={h.toFixed(1)} rx="1" fill={BAR_COLOR[b.role]} />
      })}
      {elevPath && (
        <path d={elevPath} fill="none" stroke="var(--status-info)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  )
}

// Curseur « forme du jour » : Repos · Allégé · Prévu · Renforcé · Max.
// Piste dégradée gris→vert→orange ; libellés tappables (mobile-friendly).
function FormSlider({ pos, onChange, onOpenLibrary }: { pos: number; onChange: (p: number) => void; onOpenLibrary: () => void }) {
  const M = useT().mission
  const labels = M.sliderLabels          // 5 crans de charge (Repos…Max)
  const libIdx = labels.length           // dernier cran « Bibliothèque » (index 5)
  const gradPct = ((libIdx - 1) / libIdx) * 100  // la piste dégradée s'arrête à Max (80 %)
  const allLabels = [...labels, M.sliderLibrary]
  const thumbHidden =
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:opacity-0 ' +
    '[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:opacity-0 [&::-moz-range-thumb]:border-0'
  // pos === libIdx = action « ouvrir la bibliothèque » (ne se persiste pas).
  const handle = (v: number) => (v === libIdx ? onOpenLibrary() : onChange(v))
  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-[0.12em] font-bold mb-2.5" style={{ color: 'var(--text-muted)' }}>{M.sliderCaption}</p>
      <div className="relative h-6">
        {/* piste dégradée Repos → Max */}
        <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full pointer-events-none" style={{ left: 0, width: `${gradPct}%`, background: 'linear-gradient(90deg,#6B7785 0%,#4ADE80 45%,#FBBF24 72%,#FF7900 100%)' }} />
        {/* pointillés Max → Bibliothèque */}
        <div className="absolute top-1/2 -translate-y-1/2 border-t-2 border-dotted pointer-events-none" style={{ left: `${gradPct}%`, right: 0, borderColor: 'var(--text-disabled)' }} />
        {/* crans de charge */}
        {labels.map((_, i) => (
          <span key={i} className="absolute top-1/2 w-[5px] h-[5px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${(i / libIdx) * 100}%`, background: 'rgba(11,15,20,0.55)' }} />
        ))}
        {/* nœud Bibliothèque (au bout des pointillés) */}
        <span className="absolute top-1/2 w-3.5 h-3.5 rounded-[4px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: '100%', background: 'var(--ink-600)', border: '1px solid var(--primary)' }} />
        {/* pastille (toujours sur la partie charge) */}
        <span className="absolute top-1/2 w-5 h-5 rounded-full bg-white -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${(pos / libIdx) * 100}%`, boxShadow: '0 1px 6px rgba(0,0,0,.55)', border: '3px solid var(--primary)' }} />
        <input
          type="range" min={0} max={libIdx} step={1} value={pos}
          aria-label={M.sliderCaption}
          onChange={(e) => handle(Number(e.target.value))}
          className={`absolute inset-0 w-full h-full m-0 appearance-none bg-transparent cursor-pointer ${thumbHidden}`}
        />
      </div>
      <div className="flex mt-2.5">
        {allLabels.map((lab, i) => {
          const isLib = i === libIdx
          return (
            <button
              key={i}
              type="button"
              onClick={() => handle(i)}
              className={`flex-1 text-[9.5px] ${i === 0 ? 'text-left' : isLib ? 'text-right' : 'text-center'}`}
              style={{ color: isLib ? 'var(--primary-text)' : i === pos ? 'var(--trail-text)' : 'var(--text-disabled)', fontWeight: i === pos || isLib ? 700 : 600 }}
            >
              {lab}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── types ───────────────────────────────────────────────────────────────────

// `active` couvre AUSSI bien une séance suggérée par le moteur qu'une séance
// déjà planifiée par l'athlète : MissionPlan résout `title` (libellé i18n ou
// titre libre) et `whyText` (raison du moteur, ou null si séance planifiée).
export type Props =
  | {
      state: 'active'
      title: string
      sessionType: string
      durationMin: number
      distanceKm?: number
      elevationM?: number
      intensity: IntensityLevel
      whyText?: string | null
      targetLabel?: string | null   // ex : « Seuil · 158–168 bpm »
      accentColor: string
      onOpen: () => void
      sliderPos: number
      onSliderChange: (pos: number) => void
      onOpenLibrary: () => void
    }
  | { state: 'done'; title: string; km: number; dPlus: number; durationSec: number }
  | { state: 'rest'; text: string; sliderPos: number; onSliderChange: (pos: number) => void; onOpenLibrary: () => void }

// ─── composant ───────────────────────────────────────────────────────────────

export function PlanHeroCard(props: Props & { onHide?: () => void }) {
  const M = useT().mission

  // ── état : séance du jour (suggérée OU planifiée) ───────────────────────
  if (props.state === 'active') {
    const { title, sessionType, durationMin, distanceKm, elevationM, intensity, whyText, targetLabel, accentColor, onOpen, sliderPos, onSliderChange, onOpenLibrary } = props
    const intensityDots = '●'.repeat(intensity) + '○'.repeat(5 - intensity)
    const durationLabel = [
      formatDur(durationMin),
      distanceKm ? `${distanceKm} km` : null,
      elevationM ? `+${elevationM} m` : null,
    ].filter(Boolean).join(' · ')

    return (
      <div
        className="rounded-[16px] border p-5"
        style={{
          background: `linear-gradient(150deg, ${accentColor}22 0%, var(--trail-card) 58%)`,
          borderColor: accentColor,
        }}
      >
        {/* en-tête : label + badge (+ kebab en mode expert) */}
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[10px] uppercase tracking-[0.15em] font-bold"
            style={{ color: 'var(--primary-text)' }}
          >
            {M.heroNextTitle}
          </p>
          <div className="flex items-center gap-1">
            <span
              className="text-[10px] font-bold px-2 py-1 rounded-full"
              style={{ background: 'var(--ink-800)', color: 'var(--text-secondary)' }}
            >
              {M.heroTodayBadge}
            </span>
            {props.onHide && <BlockMenu onHide={props.onHide} className="-mr-1" />}
          </div>
        </div>

        {/* gauche (cliquable) : titre + bulles · droite : profil graphique, même hauteur */}
        <div className="flex items-stretch gap-3">
          <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left" aria-label={title}>
            <p className="font-display text-[28px] font-bold leading-none text-trail-text">
              {title}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span
                className="text-[12px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'var(--primary)', color: 'var(--ink-900)' }}
              >
                {durationLabel}
              </span>
              <span
                className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'var(--ink-600)', color: 'var(--text-secondary)' }}
              >
                {intensityDots}
              </span>
              <span className="text-[15px] font-bold ml-auto leading-none" style={{ color: 'var(--primary-text)' }} aria-hidden>
                ›
              </span>
            </div>
          </button>
          <div className="w-[38%] shrink-0">
            <SessionProfile sessionType={sessionType} />
          </div>
        </div>

        {/* cible personnalisée (zone FC de l'athlète) */}
        {targetLabel && (
          <p className="text-[12px] mt-2.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-bold" style={{ color: 'var(--primary-text)' }}>{M.heroTargetPrefix}</span> · {targetLabel}
          </p>
        )}

        {/* boîte « pourquoi » — uniquement pour une séance suggérée (whyText) */}
        {whyText && (
          <div
            className="mt-3.5 rounded-[12px] p-3"
            style={{ background: 'var(--ink-800)' }}
          >
            <p
              className="text-[10px] uppercase tracking-wider font-bold mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              {M.heroWhyTitle}
            </p>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {whyText}
            </p>
          </div>
        )}

        {/* curseur « forme du jour » (remplace les anciens boutons) */}
        <FormSlider pos={sliderPos} onChange={onSliderChange} onOpenLibrary={onOpenLibrary} />
      </div>
    )
  }

  // ── état : séance déjà réalisée ─────────────────────────────────────────
  if (props.state === 'done') {
    const { title, km, dPlus, durationSec } = props
    return (
      <div
        className="relative rounded-[16px] border p-5"
        style={{
          background: 'linear-gradient(150deg, rgba(74,222,128,0.10) 0%, var(--trail-card) 58%)',
          borderColor: 'rgba(74,222,128,0.40)',
        }}
      >
        {props.onHide && (
          <div className="absolute top-3 right-3 z-10">
            <BlockMenu onHide={props.onHide} />
          </div>
        )}
        <p
          className="text-[10px] uppercase tracking-[0.15em] font-bold mb-2.5"
          style={{ color: 'var(--status-success)' }}
        >
          {M.heroDoneTitle}
        </p>
        <p className="font-display text-[30px] font-bold leading-none text-trail-text">{title}</p>
        <p className="text-[12px] mt-3" style={{ color: 'var(--text-secondary)' }}>
          {km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km
          {' · '}
          <span style={{ color: 'var(--status-info)' }}>+{dPlus} m</span>
          {' · '}
          {fmtDurSec(durationSec)}
        </p>
      </div>
    )
  }

  // ── état : repos (recommandé) — le curseur permet quand même d'ajouter ──
  return (
    <div
      className="relative rounded-[16px] border p-5"
      style={{
        background: 'linear-gradient(150deg, rgba(56,189,248,0.08) 0%, var(--trail-card) 58%)',
        borderColor: 'var(--ink-600)',
      }}
    >
      {props.onHide && (
        <div className="absolute top-3 right-3 z-10">
          <BlockMenu onHide={props.onHide} />
        </div>
      )}
      <p
        className="text-[10px] uppercase tracking-[0.15em] font-bold mb-3"
        style={{ color: 'var(--status-info)' }}
      >
        {M.heroRestTitle}
      </p>
      <p
        className="font-display text-[28px] font-bold leading-none"
        style={{ color: 'var(--text-secondary)' }}
      >
        {M.heroRestName}
      </p>
      <p className="text-[12px] mt-3" style={{ color: 'var(--text-secondary)' }}>
        {props.text}
      </p>
      <FormSlider pos={props.sliderPos} onChange={props.onSliderChange} onOpenLibrary={props.onOpenLibrary} />
    </div>
  )
}
