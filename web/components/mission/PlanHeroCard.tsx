'use client'

// Bloc héros « Ta prochaine séance » — 3 états : suggested / done / rest.
// Maquette de référence : Prompts/plan-tab-mission-final-mockup.html (bloc ①).

import { useT } from '@/lib/i18n/I18nProvider'
import type { SuggestedSession, ReasonCode } from '@/lib/mission/session-advisor'

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

// ─── types ───────────────────────────────────────────────────────────────────

type Props =
  | {
      state: 'suggested'
      session: SuggestedSession
      accentColor: string
      onDone: () => void
      onMove: () => void
      onOther: () => void
    }
  | { state: 'done'; title: string; km: number; dPlus: number; durationSec: number }
  | { state: 'rest'; reasonCode: ReasonCode }

// ─── composant ───────────────────────────────────────────────────────────────

export function PlanHeroCard(props: Props) {
  const M = useT().mission

  // ── état : séance suggérée ──────────────────────────────────────────────
  if (props.state === 'suggested') {
    const { session, accentColor, onDone, onMove, onOther } = props
    const intensityDots = '●'.repeat(session.intensity) + '○'.repeat(5 - session.intensity)
    const durationLabel = session.distanceKm
      ? `${formatDur(session.durationMin)} · ${session.distanceKm} km`
      : formatDur(session.durationMin)

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

        {/* titre de la séance */}
        <p className="font-display text-[30px] font-bold leading-none text-trail-text">
          {M.sessionTitles[session.titleKey] ?? session.titleKey}
        </p>

        {/* pills durée + intensité */}
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
        </div>

        {/* boîte « pourquoi » */}
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
            {M.reasonWhy[session.reasonCode]}
          </p>
        </div>

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
        {M.reasonWhy[props.reasonCode]}
      </p>
    </div>
  )
}
