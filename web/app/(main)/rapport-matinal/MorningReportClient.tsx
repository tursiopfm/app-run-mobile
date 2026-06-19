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
import { WeatherPrimingBlock } from '@/components/morning-report/WeatherPrimingBlock'
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
  const location = useUserLocation()
  const weather = useWeather(location.coords)

  const locationLabel = location.coords?.city ?? null

  const weatherProps =
    weather.status === 'ready' ? { status: 'ready' as const, data: weather.data, locationLabel } :
    weather.status === 'error' ? { status: 'error' as const, locationLabel } :
    { status: 'loading' as const, locationLabel }

  useEffect(() => { markSeen() }, [markSeen])

  const all = data.charge.perSport.all

  return (
    // Takeover plein écran : overlay fixe au-dessus du shell (header Trail
    // Cockpit z-40 + bottom-nav z-50) pour qu'on sache qu'on est DANS le
    // rapport matinal, et non sur un onglet de l'app.
    <div className="fixed inset-0 z-[60] bg-trail-bg overflow-y-auto overscroll-contain">
      {/* Hero dégradé « aube » + soleil levant, défile avec le contenu */}
      <div className="absolute inset-x-0 top-0 h-[440px] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg,#0B0F14 0%,#101A2B 32%,#1E2336 55%,#3A2A24 72%,#0B0F14 94%)',
          }}
        />
        <div
          className="absolute right-2 top-[120px] w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(255,121,0,0.45) 0%,rgba(255,121,0,0) 65%)' }}
        />
      </div>

      <div
        className="relative max-w-[420px] md:max-w-[860px] mx-auto px-3 sm:px-5 pb-28 space-y-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        {/* Barre du haut : pastille « Rapport matinal » + croix (pas de tab bar) */}
        <div className="flex items-center justify-between mb-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-trail-primary"
            style={{ borderColor: 'rgba(255,121,0,0.6)', background: 'rgba(255,121,0,0.10)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-trail-primary" />
            Rapport matinal
          </span>
          <Link
            href="/"
            className="w-9 h-9 rounded-full flex items-center justify-center text-body border border-trail-border text-trail-text hover:text-trail-primary"
            style={{ background: 'rgba(11,15,20,0.4)' }}
            aria-label="Fermer le rapport matinal"
          >
            ✕
          </Link>
        </div>

        <MorningHeaderLoader firstName={data.firstName} />

        <p className="text-body text-trail-muted px-1 pb-1">Ta journée en un coup d&apos;œil.</p>

        <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
          <SessionTodayBlock session={data.todaySession} />
          <FormStatusBlock payload={all} />
        </div>

        <FitnessFatigue10dChart dailyMetrics={all.dailyMetrics} />

        {location.status === 'idle' ? (
          <WeatherPrimingBlock onRequest={location.request} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <WeatherCurrentBlock {...weatherProps} />
              <WeatherDayBlock     {...weatherProps} />
            </div>
            <BestWindowBlock {...weatherProps} />
          </>
        )}

        <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2"><WeekVolumeBlock data={data.weekVolume} /></div>
            <MonthlyVolumeBlock km={data.monthlyVolume.km} dPlus={data.monthlyVolume.dPlus} />
          </div>
          <CoachAiBlock />
        </div>

        <YesterdayBlock act={data.lastActivity} />
      </div>

      {/* CTA fixe bas : on « entre » dans sa journée → sortie unique du rapport */}
      <div
        className="fixed bottom-0 inset-x-0 z-[61] px-3 sm:px-5 pt-8"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
          background: 'linear-gradient(180deg,rgba(11,15,20,0) 0%,#0B0F14 45%)',
        }}
      >
        <div className="max-w-[420px] md:max-w-[860px] mx-auto">
          <Link
            href="/"
            className="block text-center rounded-[14px] py-3.5 text-body font-bold bg-trail-primary hover:bg-trail-primary-dim"
            style={{ color: '#0B0F14' }}
          >
            Commencer ma journée →
          </Link>
        </div>
      </div>
    </div>
  )
}
