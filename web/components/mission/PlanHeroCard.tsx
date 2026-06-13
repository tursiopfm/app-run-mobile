'use client'

// Bloc héros « Ta prochaine séance » — 3 états : suggested / done / rest.
// Maquette de référence : Prompts/plan-tab-mission-final-mockup.html (bloc ①).

import { useT } from '@/lib/i18n/I18nProvider'
import type { IntensityLevel } from '@/types/plan'

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

// Résumé graphique : silhouette stylisée de la séance (hauteurs 0..1) selon sa
// nature — fractionné/côtes = pics, seuil/course = blocs soutenus, le reste =
// plateau régulier. Donne d'un coup d'œil le « caractère » de la séance.
function profileShape(sessionType: string): number[] {
  const INTERVAL = new Set(['fractionne', 'cotes'])
  const THRESHOLD = new Set(['seuil_tempo', 'course'])
  if (INTERVAL.has(sessionType)) return [0.2, 0.3, 0.95, 0.3, 0.95, 0.3, 0.95, 0.3, 0.9, 0.25, 0.2]
  if (THRESHOLD.has(sessionType)) return [0.2, 0.4, 0.85, 0.85, 0.5, 0.85, 0.85, 0.5, 0.4, 0.2]
  return [0.25, 0.45, 0.6, 0.62, 0.6, 0.62, 0.6, 0.58, 0.45, 0.25] // plateau régulier
}

// Construit le path SVG d'aire à partir de la silhouette (viewBox 100×24).
function profilePath(shape: number[]): string {
  const w = 100, h = 24, pad = 2
  const step = w / (shape.length - 1)
  const pts = shape.map((v, i) => `${(i * step).toFixed(1)},${(h - pad - v * (h - pad * 2)).toFixed(1)}`)
  return `M0,${h} L${pts.join(' L')} L${w},${h} Z`
}

function SessionProfile({ sessionType, color }: { sessionType: string; color: string }) {
  const d = profilePath(profileShape(sessionType))
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="w-full h-[22px]" aria-hidden>
      <path d={d} fill={`${color}22`} stroke={color} strokeWidth="1.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// ─── types ───────────────────────────────────────────────────────────────────

// `active` couvre AUSSI bien une séance suggérée par le moteur qu'une séance
// déjà planifiée par l'athlète : MissionPlan résout `title` (libellé i18n ou
// titre libre) et `whyText` (raison du moteur, ou null si séance planifiée).
type Props =
  | {
      state: 'active'
      title: string
      sessionType: string
      durationMin: number
      distanceKm?: number
      intensity: IntensityLevel
      whyText?: string | null
      accentColor: string
      onOpen: () => void
      onDone: () => void
      onMove: () => void
      onOther: () => void
    }
  | { state: 'done'; title: string; km: number; dPlus: number; durationSec: number }
  | { state: 'rest'; text: string }

// ─── composant ───────────────────────────────────────────────────────────────

export function PlanHeroCard(props: Props) {
  const M = useT().mission

  // ── état : séance du jour (suggérée OU planifiée) ───────────────────────
  if (props.state === 'active') {
    const { title, sessionType, durationMin, distanceKm, intensity, whyText, accentColor, onOpen, onDone, onMove, onOther } = props
    const intensityDots = '●'.repeat(intensity) + '○'.repeat(5 - intensity)
    const durationLabel = distanceKm
      ? `${formatDur(durationMin)} · ${distanceKm} km`
      : formatDur(durationMin)

    return (
      <div
        className="rounded-[16px] border p-5"
        style={{
          background: `linear-gradient(150deg, ${accentColor}22 0%, var(--trail-card) 58%)`,
          borderColor: accentColor,
        }}
      >
        {/* en-tête : label + badge */}
        <div className="flex items-center justify-between mb-2.5">
          <p
            className="text-[10px] uppercase tracking-[0.15em] font-bold"
            style={{ color: 'var(--primary-text)' }}
          >
            {M.heroNextTitle}
          </p>
          <span
            className="text-[10px] font-bold px-2 py-1 rounded-full"
            style={{ background: 'var(--ink-800)', color: 'var(--text-secondary)' }}
          >
            {M.heroTodayBadge}
          </span>
        </div>

        {/* résumé graphique : silhouette de la séance */}
        <SessionProfile sessionType={sessionType} color={accentColor} />

        {/* titre + pills = zone cliquable pour accéder au détail de la séance */}
        <button type="button" onClick={onOpen} className="w-full text-left mt-2" aria-label={title}>
          <p className="font-display text-[30px] font-bold leading-none text-trail-text">
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

        {/* actions */}
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            className="flex-1 py-2 rounded-full text-[12px] font-bold"
            style={{ background: 'var(--primary)', color: 'var(--ink-900)' }}
            onClick={onDone}
          >
            {M.heroActionDone}
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-full text-[12px] font-semibold"
            style={{ background: 'var(--ink-600)', color: 'var(--text-secondary)' }}
            onClick={onMove}
          >
            {M.heroActionMove}
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-full text-[12px] font-semibold"
            style={{ background: 'var(--ink-600)', color: 'var(--text-secondary)' }}
            onClick={onOther}
          >
            {M.heroActionOther}
          </button>
        </div>
      </div>
    )
  }

  // ── état : séance déjà réalisée ─────────────────────────────────────────
  if (props.state === 'done') {
    const { title, km, dPlus, durationSec } = props
    return (
      <div
        className="rounded-[16px] border p-5"
        style={{
          background: 'linear-gradient(150deg, rgba(74,222,128,0.10) 0%, var(--trail-card) 58%)',
          borderColor: 'rgba(74,222,128,0.40)',
        }}
      >
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

  // ── état : repos suggéré ────────────────────────────────────────────────
  return (
    <div
      className="rounded-[16px] border p-5"
      style={{
        background: 'linear-gradient(150deg, rgba(56,189,248,0.08) 0%, var(--trail-card) 58%)',
        borderColor: 'var(--ink-600)',
      }}
    >
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
    </div>
  )
}
