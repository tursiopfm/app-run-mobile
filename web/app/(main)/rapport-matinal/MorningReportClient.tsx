'use client'

import { useEffect } from 'react'
import type { MorningReportData } from '@/lib/data/morning-report'
import { useMorningReportSeen } from '@/lib/hooks/useMorningReportSeen'
import { MorningHeader } from '@/components/morning-report/MorningHeader'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MorningReportClient({ data }: { data: MorningReportData }) {
  const today = todayISO()
  const { markSeen } = useMorningReportSeen(today)

  useEffect(() => { markSeen() }, [markSeen])

  // Note: data is currently unused after removing the debug pane.
  // It will be consumed by upcoming blocks (Form, Yesterday, etc.) in later tasks.
  void data

  return (
    <div className="max-w-[420px] mx-auto p-3 sm:p-5 space-y-3">
      <MorningHeader date={new Date()} />
    </div>
  )
}
