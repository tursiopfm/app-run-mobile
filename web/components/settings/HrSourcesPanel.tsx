'use client'

import { colors } from '@/lib/design/colors'
import { getMethodMeta, requiredFieldsFor } from '@/lib/health/hr-method-meta'
import type { HrZoneMethod as Method } from '@/lib/health/hr-zones'
import type { DeducedValues } from './HrCardioFields'

type Row = {
  label:  string
  value:  number | null
  source: { tag: string; color: string }
  date:   string | null
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000))
  if (days < 1) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 30) return `il y a ${days}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function HrSourcesPanel({
  method, profile, deduced, methodUpdatedAt,
}: {
  method:           Method
  profile: {
    max_hr:               number | null
    resting_hr:           number | null
    threshold_hr:         number | null
    aerobic_threshold_hr: number | null
    birth_year:           number | null
  }
  deduced:          DeducedValues
  methodUpdatedAt:  string | null
}) {
  const meta = getMethodMeta(method)
  const required = requiredFieldsFor(method)

  const estimatedAge = profile.birth_year
    ? Math.round(208 - 0.7 * (new Date().getFullYear() - profile.birth_year))
    : null

  const rows: Array<Row & { activeKey: string }> = [
    { activeKey: 'max_hr',               label: 'FC max',           value: profile.max_hr,           source: { tag: '✓ Saisie',    color: '#22c55e' }, date: methodUpdatedAt },
    { activeKey: 'resting_hr',           label: 'FC repos',         value: profile.resting_hr,       source: { tag: '✓ Saisie',    color: '#22c55e' }, date: methodUpdatedAt },
    { activeKey: 'aerobic_threshold_hr', label: 'AeT (aérobie)',    value: profile.aerobic_threshold_hr, source: { tag: '✓ Saisie', color: '#22c55e' }, date: methodUpdatedAt },
    { activeKey: 'threshold_hr',         label: 'LTHR (anaéro)',    value: profile.threshold_hr,     source: { tag: '✓ Saisie',    color: '#22c55e' }, date: methodUpdatedAt },
    { activeKey: 'deduced_max',          label: 'FC max observée',  value: deduced.maxHrObserved,    source: { tag: '📡 Strava',   color: '#fb923c' }, date: deduced.computedAt },
    { activeKey: 'deduced_rest',         label: 'FC repos estimée', value: deduced.restingHrEstimated, source: { tag: '📡 Strava', color: '#fb923c' }, date: deduced.computedAt },
    { activeKey: 'deduced_lthr',         label: 'LTHR estimée',     value: deduced.lthrEstimated,    source: { tag: '∫ Calculée',  color: '#facc15' }, date: deduced.computedAt },
    { activeKey: 'estimated_max',        label: 'FC max estimée',   value: estimatedAge,             source: { tag: '📅 Âge',      color: '#9ca3af' }, date: null },
  ]

  const allEmpty = rows.every(r => r.value == null)
  if (allEmpty) return null

  function isActive(key: string): boolean {
    if (method === 'deduced') return ['deduced_max', 'deduced_rest', 'deduced_lthr'].includes(key)
    if (method === 'auto')    return key === 'estimated_max' || key === 'max_hr'
    return required.includes(key as ReturnType<typeof requiredFieldsFor>[number])
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[10px]">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold text-trail-text">Sources des valeurs</p>
        <span
          className="text-[10px] font-bold px-[8px] py-[2px] rounded-full"
          style={{ backgroundColor: meta.badgeBg, color: meta.color }}
        >
          {meta.label}
        </span>
      </div>

      <table className="w-full text-[12px]">
        <thead>
          <tr style={{ color: colors.subtleText }}>
            <th className="text-left font-medium py-[4px] text-[10px] uppercase">Valeur</th>
            <th className="text-right font-medium py-[4px] text-[10px] uppercase">Utilisée</th>
            <th className="text-right font-medium py-[4px] text-[10px] uppercase">Source</th>
            <th className="text-right font-medium py-[4px] text-[10px] uppercase">Maj</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const active = isActive(r.activeKey)
            return (
              <tr key={r.activeKey} style={{ borderTop: `1px solid ${colors.border}` }}>
                <td className="py-[6px]" style={{ color: colors.text }}>{r.label}</td>
                <td className="py-[6px] text-right font-semibold" style={{ color: active ? colors.text : colors.subtleText }}>
                  {r.value != null ? `${r.value} bpm` : '—'}
                </td>
                <td className="py-[6px] text-right text-[11px]" style={{ color: r.source.color }}>{r.source.tag}</td>
                <td className="py-[6px] text-right text-[11px]" style={{ color: colors.subtleText }}>{formatRelative(r.date)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="text-[11px] text-trail-muted leading-[16px] pl-2" style={{ borderLeft: '3px solid #22c55e' }}>
        Les valeurs <strong className="text-trail-text">en blanc</strong> sont utilisées par la méthode active. Les autres sont calculées en parallèle, dispo si tu changes de méthode.
      </p>
    </div>
  )
}
