'use client'

import { useState, useRef, useEffect } from 'react'
import type { StravaLap } from '@/lib/activities/detail'
import { lapPaceSec, detectFastLaps, fmtPaceSec, fmtLapDist } from '@/lib/activities/detail'

const GRID_COLS = '28px 1fr 52px 68px 36px'

export function ActivityFractionneSplits({ laps }: { laps: StravaLap[] }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fastSplits = detectFastLaps(laps)
  const hasFastLaps = fastSplits.size > 0

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  async function handleCopy() {
    const text = laps
      .filter(lap => {
        const splitKey = lap.split ?? (lap.lap_index + 1)
        return fastSplits.has(splitKey)
      })
      .map(lap => fmtPaceSec(lap.moving_time))
      .join('/')

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Summary line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--trail-muted)' }}>{laps.length} blocs</span>
        {hasFastLaps && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e8651a' }}>
            {fastSplits.size} bloc{fastSplits.size > 1 ? 's' : ''} rapide{fastSplits.size > 1 ? 's' : ''} détecté{fastSplits.size > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        padding: '4px 0 8px',
        borderBottom: '1px solid var(--trail-border)',
        marginBottom: 2,
      }}>
        {['#', 'Distance', 'Temps', 'Allure', 'D+'].map(h => (
          <span key={h} style={{
            fontSize: 11, fontWeight: 700,
            color: 'var(--trail-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}>
            {h}
          </span>
        ))}
      </div>

      {/* Lap rows */}
      {laps.map(lap => {
        const pace = lapPaceSec(lap)
        const splitKey = lap.split ?? (lap.lap_index + 1)
        const isFast = fastSplits.has(splitKey)
        const elev = Math.round(lap.total_elevation_gain)

        return (
          <div
            key={lap.id ?? splitKey}
            style={{
              display: 'grid',
              gridTemplateColumns: GRID_COLS,
              alignItems: 'center',
              padding: '8px 0',
              paddingLeft: isFast ? 6 : 0,
              borderBottom: '1px solid var(--trail-border)',
              borderLeft: isFast ? '3px solid #e8651a' : '3px solid transparent',
              background: isFast ? 'rgba(232,101,26,0.07)' : 'transparent',
            }}
          >
            {/* # badge */}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: isFast ? 'rgba(232,101,26,0.22)' : 'var(--trail-card)',
              border: `1px solid ${isFast ? 'rgba(232,101,26,0.55)' : 'var(--trail-border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              color: isFast ? '#e8651a' : 'var(--trail-muted)',
              flexShrink: 0,
            }}>
              {lap.split ?? (lap.lap_index + 1)}
            </div>

            {/* Distance + RAPIDE badge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--trail-text)' }}>
                {fmtLapDist(lap.distance)}
              </span>
              {isFast && (
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  color: '#e8651a',
                  background: 'rgba(232,101,26,0.15)',
                  borderRadius: 3,
                  padding: '1px 4px',
                  width: 'fit-content',
                  letterSpacing: '0.4px',
                }}>
                  RAPIDE
                </span>
              )}
            </div>

            {/* Temps */}
            <span style={{
              fontSize: 13,
              fontWeight: isFast ? 800 : 500,
              color: isFast ? 'var(--trail-text)' : 'var(--trail-muted)',
            }}>
              {fmtPaceSec(lap.moving_time)}
            </span>

            {/* Allure */}
            <span style={{ fontSize: 12, color: 'var(--trail-muted)' }}>
              {pace ? `${fmtPaceSec(pace)}/km` : '—'}
            </span>

            {/* D+ */}
            <span style={{ fontSize: 12, color: elev > 0 ? '#8bc34a' : 'var(--trail-border)' }}>
              {elev > 0 ? `+${elev}m` : ''}
            </span>
          </div>
        )
      })}

      {/* Copy button */}
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          disabled={!hasFastLaps}
          onClick={handleCopy}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: hasFastLaps ? 'rgba(232,101,26,0.18)' : 'var(--trail-card)',
            border: `1px solid ${hasFastLaps ? 'rgba(232,101,26,0.4)' : 'var(--trail-border)'}`,
            borderRadius: 10,
            color: hasFastLaps ? '#e8651a' : 'var(--trail-muted)',
            fontSize: 13, fontWeight: 800,
            cursor: hasFastLaps ? 'pointer' : 'default',
          }}
        >
          {copyState === 'error'
            ? 'Impossible de copier'
            : copyState === 'copied'
            ? 'Copié !'
            : hasFastLaps
            ? `Copier les temps rapides (${fastSplits.size})`
            : 'Aucun bloc rapide détecté'}
        </button>
      </div>
    </div>
  )
}
