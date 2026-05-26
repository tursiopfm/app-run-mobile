'use client'

import Link from 'next/link'
import { Heart, ChevronRight } from 'lucide-react'
import { getMethodMeta } from '@/lib/health/hr-method-meta'
import type { HrZoneMethod } from '@/lib/health/hr-zones'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  method:      HrZoneMethod | null
  maxHr:       number | null
  thresholdHr: number | null
}

export function HrCalibrationTeaser({ method, maxHr, thresholdHr }: Props) {
  const L = useT().settings
  const isConfigured = method != null
  const meta = isConfigured ? getMethodMeta(method) : null

  const bits: string[] = []
  if (meta) bits.push(meta.label)
  if (maxHr)       bits.push(`${L.hrMaxLabel} ${maxHr}`)
  if (thresholdHr) bits.push(`${L.hrThresholdLabel} ${thresholdHr}`)
  const subtitle = isConfigured
    ? bits.join(' · ')
    : L.hrCalibrationNotConfigured

  return (
    <Link
      href="/profile"
      className="flex items-center gap-3 px-3 py-[12px] rounded-[10px] bg-trail-surface hover:bg-trail-border/30 transition-colors group"
    >
      <div className="w-10 h-10 rounded-[12px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
        <Heart size={18} className="text-trail-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-trail-text">
            {L.hrCalibrationTitle}
          </p>
          {meta && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-[6px] py-[1px] rounded-[4px]"
              style={{ backgroundColor: meta.badgeBg, color: meta.color }}
            >
              {meta.badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-trail-muted truncate mt-[2px]">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-trail-muted flex-shrink-0 group-hover:text-trail-text transition-colors" />
    </Link>
  )
}
