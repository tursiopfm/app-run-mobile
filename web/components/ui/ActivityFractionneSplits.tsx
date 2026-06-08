'use client'

import { useState, useRef, useEffect } from 'react'
import type { StravaLap, FracEffort, FracPhase } from '@/lib/activities/detail'
import { analyzeFractionne, fmtDurationSec, fmtPaceSec, fmtLapDist } from '@/lib/activities/detail'
import { useT } from '@/lib/i18n/I18nProvider'

const FAST = '#e8651a'
const WARM = '#3aa0c9'
const COOL = '#46c08a'
const REC  = '#7d938e'

function phaseColor(kind: FracPhase['kind']): string {
  if (kind === 'warmup') return WARM
  if (kind === 'cooldown') return COOL
  return REC
}

export function ActivityFractionneSplits({ laps }: { laps: StravaLap[] }) {
  const L = useT().activities
  const a = analyzeFractionne(laps)
  const hasEfforts = a.isInterval && a.efforts.length > 0

  const [detailOpen, setDetailOpen] = useState(true)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  async function handleCopy() {
    const text = a.efforts.map(e => fmtDurationSec(e.movingTime)).join('/')
    try {
      await navigator.clipboard.writeText(text)
      if (timerRef.current) clearTimeout(timerRef.current)
      setCopyState('copied')
      timerRef.current = setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      if (timerRef.current) clearTimeout(timerRef.current)
      setCopyState('error')
      timerRef.current = setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  const copyLabel =
    copyState === 'error' ? L.copyFailed
    : copyState === 'copied' ? L.importCopied
    : hasEfforts ? L.copyFastTimes(a.efforts.length)
    : L.importNoBlock

  // ── Fallback: not an interval session → plain lap list ───────────────────────
  if (!hasEfforts) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 12, color: 'var(--trail-muted)', marginBottom: 10 }}>
          {a.rows.length} {L.fracBlocksCount}
        </div>
        {a.rows.map(r => (
          <div key={r.index} style={{
            display: 'grid', gridTemplateColumns: '28px 1fr 56px 64px',
            alignItems: 'center', padding: '8px 0',
            borderBottom: '1px solid var(--trail-border)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--trail-muted)' }}>{r.index}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtLapDist(r.distance)}</span>
            <span style={{ fontSize: 13, color: 'var(--trail-muted)', textAlign: 'right' }}>{fmtDurationSec(r.movingTime)}</span>
            <span style={{ fontSize: 12, color: 'var(--trail-muted)', textAlign: 'right' }}>
              {r.paceSec ? `${fmtPaceSec(r.paceSec)}/km` : '—'}
            </span>
          </div>
        ))}
        <button type="button" disabled style={copyBtnStyle(false)}>{L.importNoBlock}</button>
      </div>
    )
  }

  // ── Bars (effort pace → height, faster = taller) ─────────────────────────────
  const effPaces = a.efforts.map(e => e.paceSec ?? 0).filter(p => p > 0)
  const fastest = effPaces.length ? Math.min(...effPaces) : 0
  const slowest = effPaces.length ? Math.max(...effPaces) : 0
  const barHeight = (p: number | null) => {
    if (!p || slowest === fastest) return 100
    return Math.round(40 + 60 * (slowest - p) / (slowest - fastest))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Hero summary + bars */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(232,101,26,0.18), rgba(232,101,26,0.03))',
        border: '1px solid rgba(232,101,26,0.35)', borderRadius: 16,
        padding: '14px 16px', marginBottom: 13,
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-data)', letterSpacing: '-0.4px' }}>{a.structureLabel}</div>
        <div style={{ fontSize: 11.5, color: 'var(--trail-muted)', marginTop: 3 }}>
          {a.avgRecoverySec != null && <>{L.fracRecoveryShort} ~{fmtDurationSec(a.avgRecoverySec)} · </>}
          {L.fracAvgEffort} {a.avgEffortPaceSec ? `${fmtPaceSec(a.avgEffortPaceSec)}/km` : '—'}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, height: 68, marginTop: 16, paddingTop: 14 }}>
          {a.efforts.map(e => (
            <div key={e.rep} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', flex: 1 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums', color: FAST, whiteSpace: 'nowrap', marginBottom: 3 }}>
                  {e.paceSec ? fmtPaceSec(e.paceSec) : '—'}
                </span>
                <div style={{
                  width: '100%', height: `${barHeight(e.paceSec)}%`, minHeight: 6,
                  background: `linear-gradient(180deg, #ff7043, ${FAST})`, borderRadius: '5px 5px 0 0',
                }} />
              </div>
              <span style={{ fontSize: 9.5, color: 'var(--trail-muted)', fontWeight: 700 }}>{e.rep}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Warm-up card */}
      {a.warmup && <PhaseCard phase={a.warmup} label={L.fracPhaseWarmup} />}

      {/* Main set — expandable */}
      <div
        onClick={() => setDetailOpen(o => !o)}
        style={{ ...cardStyle(FAST), cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', fontSize: 10, color: 'var(--trail-muted)',
              transform: detailOpen ? 'rotate(90deg)' : 'none', transition: 'transform .18s ease',
            }}>▶</span>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{L.fracMainBlock(a.efforts.length)}</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-data)', color: FAST, fontVariantNumeric: 'tabular-nums' }}>
            {a.avgEffortPaceSec ? fmtPaceSec(a.avgEffortPaceSec) : '—'}
          </span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--trail-muted)', marginTop: 2 }}>
          {a.structureLabel} · {L.fracTapDetail}
        </div>

        {detailOpen && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ marginTop: 10, borderTop: '1px solid var(--trail-border)', paddingTop: 6 }}
          >
            {a.items.map((it, idx) =>
              it.type === 'effort'
                ? <DetailRow key={`e${it.effort.rep}`} effort={it.effort} />
                : <DetailRow key={`r${idx}`} recovery={it.phase} recLabel={L.fracRecoveryShort} />
            )}
          </div>
        )}
      </div>

      {/* Cool-down card */}
      {a.cooldown && <PhaseCard phase={a.cooldown} label={L.fracPhaseCooldown} />}

      {/* Copy button */}
      <button type="button" disabled={!hasEfforts} onClick={handleCopy} style={copyBtnStyle(hasEfforts)}>
        {copyLabel}
      </button>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function PhaseCard({ phase, label }: { phase: FracPhase; label: string }) {
  const c = phaseColor(phase.kind)
  return (
    <div style={cardStyle(c)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={tagStyle(c)}>{label}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-data)' }}>{fmtLapDist(phase.distance)}</span>
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-data)', color: c, fontVariantNumeric: 'tabular-nums' }}>
          {phase.paceSec ? fmtPaceSec(phase.paceSec) : '—'}
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--trail-muted)', marginTop: 2 }}>{fmtDurationSec(phase.movingTime)}</div>
    </div>
  )
}

function DetailRow({ effort, recovery, recLabel }: { effort?: FracEffort; recovery?: FracPhase; recLabel?: string }) {
  if (effort) {
    return (
      <div style={detailRowStyle}>
        <span style={badgeStyle(false)}>{effort.rep}</span>
        <span style={{ fontSize: 11.5 }}>
          {fmtLapDist(effort.distance)}
          {effort.laps.length > 1 && <span style={{ color: 'var(--trail-muted)' }}> ({effort.laps.length}×)</span>}
        </span>
        <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{fmtDurationSec(effort.movingTime)}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font-data)', color: FAST, fontVariantNumeric: 'tabular-nums', minWidth: 52, textAlign: 'right' }}>
          {effort.paceSec ? `${fmtPaceSec(effort.paceSec)}/km` : '—'}
        </span>
      </div>
    )
  }
  const r = recovery!
  return (
    <div style={detailRowStyle}>
      <span style={badgeStyle(true)}>r</span>
      <span style={{ fontSize: 11.5, color: REC }}>{recLabel} {fmtLapDist(r.distance)}</span>
      <span style={{ fontSize: 11.5, color: REC, fontVariantNumeric: 'tabular-nums' }}>{fmtDurationSec(r.movingTime)}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: REC, fontVariantNumeric: 'tabular-nums', minWidth: 52, textAlign: 'right' }}>
        {r.paceSec ? `${fmtPaceSec(r.paceSec)}/km` : '—'}
      </span>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const detailRowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '24px 1fr auto auto',
  alignItems: 'center', gap: 9, padding: '6px 0',
  borderTop: '1px solid var(--trail-border)', fontSize: 11.5,
}

function cardStyle(accent: string): React.CSSProperties {
  return {
    border: '1px solid var(--trail-border)', borderLeft: `3px solid ${accent}`,
    borderRadius: 13, padding: '11px 13px', marginBottom: 9, background: 'var(--trail-card)',
  }
}

function tagStyle(color: string): React.CSSProperties {
  return {
    fontSize: 9.5, fontWeight: 600, letterSpacing: '0.5px', padding: '2px 6px',
    borderRadius: 4, textTransform: 'uppercase', color, background: `${color}22`,
  }
}

function badgeStyle(isRec: boolean): React.CSSProperties {
  return {
    width: 19, height: 19, borderRadius: '50%',
    background: isRec ? 'rgba(125,147,142,0.18)' : 'rgba(232,101,26,0.18)',
    color: isRec ? REC : FAST, fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

function copyBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%', marginTop: 16, padding: '11px',
    background: enabled ? 'rgba(232,101,26,0.16)' : 'var(--trail-card)',
    border: `1px solid ${enabled ? 'rgba(232,101,26,0.4)' : 'var(--trail-border)'}`,
    borderRadius: 11, color: enabled ? FAST : 'var(--trail-muted)',
    fontSize: 12.5, fontWeight: 600, cursor: enabled ? 'pointer' : 'default',
  }
}
