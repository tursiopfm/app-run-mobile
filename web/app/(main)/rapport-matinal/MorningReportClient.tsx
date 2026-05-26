'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import type { MorningReportData } from '@/lib/data/morning-report'
import { useMorningReportSeen } from '@/lib/hooks/useMorningReportSeen'
import { MorningHeaderLoader } from '@/components/morning-report/MorningHeaderLoader'
import { SessionTodayBlock } from '@/components/morning-report/SessionTodayBlock'
import { FormStatusBlock } from '@/components/morning-report/FormStatusBlock'
import { FitnessFatigue10dChart } from '@/components/morning-report/FitnessFatigue10dChart'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import { useWeather } from '@/lib/hooks/useWeather'
import { WeatherCurrentBlock } from '@/components/morning-report/WeatherCurrentBlock'
import { WeatherDayBlock } from '@/components/morning-report/WeatherDayBlock'
import { BestWindowBlock } from '@/components/morning-report/BestWindowBlock'
import { WeekVolumeBlock } from '@/components/morning-report/WeekVolumeBlock'
import { MonthlyVolumeBlock } from '@/components/morning-report/MonthlyVolumeBlock'
import { CoachAiBlock } from '@/components/morning-report/CoachAiBlock'
import { YesterdayBlock } from '@/components/morning-report/YesterdayBlock'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MorningReportClient({ data }: { data: MorningReportData }) {
  const today = todayISO()
  const { markSeen } = useMorningReportSeen(today)
  const coords = useUserLocation()
  const weather = useWeather(coords)

  const locationLabel = coords?.city ?? null

  const weatherProps =
    weather.status === 'ready' ? { status: 'ready' as const, data: weather.data, locationLabel } :
    weather.status === 'error' ? { status: 'error' as const, locationLabel } :
    { status: 'loading' as const, locationLabel }

  useEffect(() => { markSeen() }, [markSeen])

  const all = data.charge.perSport.all

  return (
    <div className="max-w-[420px] mx-auto p-3 sm:p-5 space-y-3">
      <header className="flex items-center justify-between mb-1 px-1">
        <p className="text-[11px] text-trail-muted uppercase tracking-[0.15em]">Rapport matinal</p>
        <Link
          href="/"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] bg-trail-surface border border-trail-border text-trail-muted hover:text-trail-text"
          aria-label="Fermer le rapport matinal"
        >
          ✕
        </Link>
      </header>

      <MorningHeaderLoader firstName={data.firstName} />
      <SessionTodayBlock session={data.todaySession} />
      <FormStatusBlock payload={all} />
      <FitnessFatigue10dChart dailyMetrics={all.dailyMetrics} />
      <div className="grid grid-cols-2 gap-2.5">
        <WeatherCurrentBlock {...weatherProps} />
        <WeatherDayBlock     {...weatherProps} />
      </div>
      <BestWindowBlock {...weatherProps} />
      <div className="grid grid-cols-3 gap-2.5">
        <div className="col-span-2"><WeekVolumeBlock data={data.weekVolume} /></div>
        <MonthlyVolumeBlock km={data.monthlyVolume.km} dPlus={data.monthlyVolume.dPlus} />
      </div>
      <CoachAiBlock />
      <YesterdayBlock act={data.lastActivity} />

      <Link
        href="/"
        className="block text-center py-3 mt-2 text-[13px] text-trail-muted hover:text-trail-text"
      >
        ← Fermer le rapport
      </Link>
    </div>
  )
}
