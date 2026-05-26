'use client'

type Props = { km: number; dPlus: number }

export function MonthlyVolumeBlock({ km, dPlus }: Props) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] flex flex-col">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-[13px] font-semibold text-trail-muted">Ce mois</h3>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-1.5">
        <div className="flex items-baseline gap-1">
          <p className="text-[22px] leading-none text-trail-primary" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{Math.round(km)}</p>
          <p className="text-[11px] text-trail-muted">km</p>
        </div>
        <div className="flex items-baseline gap-1">
          <p className="text-[22px] leading-none text-trail-accent" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{Math.round(dPlus)}</p>
          <p className="text-[11px] text-trail-muted">m D+</p>
        </div>
      </div>
    </div>
  )
}
