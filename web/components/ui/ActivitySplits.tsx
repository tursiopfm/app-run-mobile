'use client'

import { splitPaceSec, paceGradientColor, fmtPaceSec } from '@/lib/activities/detail'
import type { StravaSplit } from '@/lib/activities/detail'
import { useT } from '@/lib/i18n/I18nProvider'

// Écart d'allure max (sec/km) représenté par une demi-barre pleine.
// Au-delà (typiquement une côte marchée), la barre sature et un chevron l'indique.
const CLAMP = 70

export function ActivitySplits({
  splits,
  avgPaceSec,
}: {
  splits: StravaSplit[]
  avgPaceSec: number
}) {
  const L = useT().activities
  if (!splits.length) return null

  const paces = splits.map(s => splitPaceSec(s))
  const validPaces = paces.filter((p): p is number => p !== null)
  const minPace = validPaces.length ? Math.min(...validPaces) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header: segment count + best split */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--trail-muted)' }}>{splits.length} {L.splitsCount}</span>
        {minPace > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: paceGradientColor(minPace, minPace, avgPaceSec) }}>
            {L.splitsBest(fmtPaceSec(minPace))}
          </span>
        )}
      </div>

      {/* Axis legend: slower ← | avg | → faster */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--trail-muted)', marginBottom: 8, padding: '0 2px' }}>
        <span>← {L.splitsSlower}</span>
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums' }}>{L.splitsAvg} {fmtPaceSec(avgPaceSec)}</span>
        <span>{L.splitsFaster} →</span>
      </div>

      {splits.map((split, i) => {
        const pace = paces[i]
        if (pace === null) return null

        const color = paceGradientColor(pace, minPace, avgPaceSec)
        const delta = avgPaceSec - pace          // > 0 → plus rapide que la moyenne
        const fast = delta >= 0
        const over = Math.abs(delta) > CLAMP
        const mag = Math.min(Math.abs(delta) / CLAMP, 1) * 48   // % de la demi-piste
        const elev = Math.round(split.elevation_difference)
        const isBest = pace === minPace

        // Barre divergente : rapide → à droite de l'axe, lent → à gauche.
        const barStyle: React.CSSProperties = {
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          height: 11, width: `${mag}%`,
          background: fast
            ? `linear-gradient(90deg, ${color}cc, ${color})`
            : `linear-gradient(270deg, ${color}cc, ${color})`,
          borderRadius: fast ? '2px 5px 5px 2px' : '5px 2px 2px 5px',
        }
        if (fast) barStyle.left = '50%'
        else barStyle.right = '50%'

        const chevStyle: React.CSSProperties = {
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          fontSize: 10, lineHeight: 1, fontWeight: 700, color: '#0B0F14',
        }
        if (fast) chevStyle.right = 1
        else chevStyle.left = 1

        return (
          <div
            key={split.split}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '6px 0', borderBottom: '1px solid var(--trail-border)',
            }}
          >
            {/* Circular km badge */}
            <div
              style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums',
                background: isBest ? 'var(--trail-primary)' : 'var(--trail-card)',
                border: `1px solid ${isBest ? 'var(--trail-primary)' : 'var(--trail-border)'}`,
                color: isBest ? '#0B0F14' : 'var(--trail-muted)',
              }}
            >
              {split.split}
            </div>

            {/* Diverging track */}
            <div style={{ flex: 1, position: 'relative', height: 20 }}>
              <div style={{ position: 'absolute', left: '50%', top: 1, bottom: 1, width: 1, background: 'var(--trail-border)', transform: 'translateX(-0.5px)' }} />
              <div style={barStyle}>
                {over && <span style={chevStyle}>{fast ? '›' : '‹'}</span>}
              </div>
            </div>

            {/* Pace */}
            <span style={{
              fontSize: 14, fontWeight: 700, width: 42, textAlign: 'right',
              color, flexShrink: 0, fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtPaceSec(pace)}
            </span>

            {/* Elevation */}
            <span style={{
              fontSize: 12, width: 40, textAlign: 'right', flexShrink: 0, fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums',
              color: elev > 0 ? '#C7A553' : elev < 0 ? '#6FA9C9' : 'var(--trail-muted)',
            }}>
              {elev > 0 ? `↑${elev}m` : elev < 0 ? `↓${Math.abs(elev)}m` : ''}
            </span>
          </div>
        )
      })}

      {/* Color scale legend */}
      <div style={{ marginTop: 16 }}>
        <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(90deg, #38BDF8 0%, #4ADE80 33%, #FBBF24 66%, #FF7900 100%)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 10, color: 'var(--trail-muted)' }}>
          <span>{L.splitsSlower}</span>
          <span>{L.splitsFaster}</span>
        </div>
      </div>
    </div>
  )
}
