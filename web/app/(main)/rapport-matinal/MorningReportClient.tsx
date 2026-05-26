'use client'

import { useEffect } from 'react'
import type { MorningReportData } from '@/lib/data/morning-report'
import { useMorningReportSeen } from '@/lib/hooks/useMorningReportSeen'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MorningReportClient({ data }: { data: MorningReportData }) {
  const today = todayISO()
  const { markSeen } = useMorningReportSeen(today)

  useEffect(() => { markSeen() }, [markSeen])

  const last = data.charge.perSport.all.dailyMetrics.at(-1)

  return (
    <div className="max-w-[420px] mx-auto p-3 sm:p-5 space-y-3">
      <p className="text-[11px] text-trail-muted">Rapport matinal — squelette</p>
      <pre className="text-[10px] text-trail-muted whitespace-pre-wrap">
        {JSON.stringify({
          generatedAt: data.generatedAt,
          atl: Math.round(last?.atl ?? 0),
          ctl: Math.round(last?.ctl ?? 0),
          tsb: Math.round(last?.tsb ?? 0),
          lastActivityName: data.lastActivity?.name ?? null,
        }, null, 2)}
      </pre>
    </div>
  )
}
