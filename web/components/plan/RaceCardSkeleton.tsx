'use client'

export function RaceCardSkeleton() {
  return (
    <div className="relative animate-pulse">
      <div className="pt-2 pr-[88px]">
        <div className="h-[28px] w-[60%] rounded-[6px] bg-trail-surface" />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="h-[44px] w-[120px] rounded-[6px] bg-trail-surface" />
        <div className="h-[12px] w-[80px] rounded-[6px] bg-trail-surface" />
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {[60, 80, 50, 70].map((w, i) => (
          <div key={i} className="h-[22px] rounded-full bg-trail-surface" style={{ width: w }} />
        ))}
      </div>
    </div>
  )
}
