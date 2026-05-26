'use client'

import { colors } from '@/lib/design/colors'
import { getMethodMeta, requiredFieldsFor } from '@/lib/health/hr-method-meta'
import type { HrZoneMethod as Method } from '@/lib/health/hr-zones'
import type { DeducedValues } from './HrCardioFields'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

type Row = {
  label:  string
  value:  number | null
  source: { tag: string; color: string }
  date:   string | null
}

function formatRelative(iso: string | null, L: Dict['settings'], locale: string): string {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000))
  if (days < 1) return L.hrRelToday
  if (days === 1) return L.hrRelYesterday
  if (days < 30) return L.hrRelDaysAgo(days)
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short' })
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
  const L = useT().settings
  const { lang } = useLang()
  const locale = lang === 'en' ? 'en-US' : 'fr-FR'
  const meta = getMethodMeta(method)
  const required = requiredFieldsFor(method)

  const estimatedAge = profile.birth_year
    ? Math.round(208 - 0.7 * (new Date().getFullYear() - profile.birth_year))
    : null

  const tagEntered  = { tag: L.hrSourceTagEntered, color: '#22c55e' }
  const tagStrava   = { tag: L.hrSourceTagStrava,  color: '#fb923c' }
  const tagComputed = { tag: L.hrSourceTagComputed,color: '#facc15' }
  const tagAge      = { tag: L.hrSourceTagAge,     color: '#9ca3af' }

  const rows: Array<Row & { activeKey: string }> = [
    { activeKey: 'max_hr',               label: L.hrSourceRowMaxHr,   value: profile.max_hr,               source: tagEntered,  date: methodUpdatedAt },
    { activeKey: 'resting_hr',           label: L.hrSourceRowResting, value: profile.resting_hr,           source: tagEntered,  date: methodUpdatedAt },
    { activeKey: 'aerobic_threshold_hr', label: L.hrSourceRowAerobic, value: profile.aerobic_threshold_hr, source: tagEntered,  date: methodUpdatedAt },
    { activeKey: 'threshold_hr',         label: L.hrSourceRowLthr,    value: profile.threshold_hr,         source: tagEntered,  date: methodUpdatedAt },
    { activeKey: 'deduced_max',          label: L.hrSourceRowMaxObs,  value: deduced.maxHrObserved,        source: tagStrava,   date: deduced.computedAt },
    { activeKey: 'deduced_rest',         label: L.hrSourceRowRestEst, value: deduced.restingHrEstimated,   source: tagStrava,   date: deduced.computedAt },
    { activeKey: 'deduced_lthr',         label: L.hrSourceRowLthrEst, value: deduced.lthrEstimated,        source: tagComputed, date: deduced.computedAt },
    { activeKey: 'estimated_max',        label: L.hrSourceRowMaxEst,  value: estimatedAge,                 source: tagAge,      date: null },
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
        <p className="text-[14px] font-bold text-trail-text">{L.hrSourcesTitle}</p>
        <span
          className="text-[10px] font-bold px-[8px] py-[2px] rounded-full"
          style={{ backgroundColor: meta.badgeBg, color: meta.color }}
        >
          {L.hrMethods[method].label}
        </span>
      </div>

      <table className="w-full text-[12px]">
        <thead>
          <tr style={{ color: colors.subtleText }}>
            <th className="text-left font-medium py-[4px] text-[10px] uppercase">{L.hrSourcesValueCol}</th>
            <th className="text-right font-medium py-[4px] text-[10px] uppercase">{L.hrSourcesUsedCol}</th>
            <th className="text-right font-medium py-[4px] text-[10px] uppercase">{L.hrSourcesSourceCol}</th>
            <th className="text-right font-medium py-[4px] text-[10px] uppercase">{L.hrSourcesUpdatedCol}</th>
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
                <td className="py-[6px] text-right text-[11px]" style={{ color: colors.subtleText }}>{formatRelative(r.date, L, locale)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="text-[11px] text-trail-muted leading-[16px] pl-2" style={{ borderLeft: '3px solid #22c55e' }}>
        {L.hrSourcesFootnote}
      </p>
    </div>
  )
}
