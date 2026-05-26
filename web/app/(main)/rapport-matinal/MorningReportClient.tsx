'use client'

import { useEffect } from 'react'
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

  const weatherProps =
    weather.status === 'ready' ? { status: 'ready' as const, data: weather.data } :
    weather.status === 'error' ? { status: 'error' as const } :
    { status: 'loading' as const }

  useEffect(() => { markSeen() }, [markSeen])

  const all = data.charge.perSport.all

  return (
    <div className="max-w-[420px] mx-auto p-3 sm:p-5 space-y-3">
      <MorningHeaderLoader />
      <SessionTodayBlock />
      <FormStatusBlock payload={all} />
      <FitnessFatigue10dChart dailyMetrics={all.dailyMetrics} />
      <div className="grid grid-cols-2 gap-2.5">
        <WeatherCurrentBlock {...weatherProps} />
        <WeatherDayBlock     {...weatherProps} />
      </div>
      <BestWindowBlock {...weatherProps} />
      <MonthlyVolumeBlock km={data.monthlyVolume.km} dPlus={data.monthlyVolume.dPlus} />
      <CoachAiBlock />
      <YesterdayBlock act={data.lastActivity} />
    </div>
  )
}
