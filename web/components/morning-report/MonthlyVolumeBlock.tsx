'use client'

import { ReportCard } from './ReportCard'

type Props = { km: number; dPlus: number }

export function MonthlyVolumeBlock({ km, dPlus }: Props) {
  return (
    <ReportCard label="Ce mois" accent="var(--trail-primary)" className="h-full">
      <div className="flex flex-col justify-center gap-1.5">
        <div className="flex items-baseline gap-1">
          <p className="text-h1 leading-none text-trail-primary" style={{ fontFamily: "var(--font-data)" }}>{Math.round(km)}</p>
          <p className="text-micro text-trail-muted">km</p>
        </div>
        <div className="flex items-baseline gap-1">
          <p className="text-h1 leading-none text-trail-accent" style={{ fontFamily: "var(--font-data)" }}>{Math.round(dPlus)}</p>
          <p className="text-micro text-trail-muted">m D+</p>
        </div>
      </div>
    </ReportCard>
  )
}
