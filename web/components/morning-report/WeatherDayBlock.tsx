'use client'

const PERIODS = [
  { h: '8h',  icon: '☀️' },
  { h: '12h', icon: '⛅' },
  { h: '16h', icon: '🌧️' },
  { h: '20h', icon: '☁️' },
] as const

export function WeatherDayBlock() {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] flex flex-col">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-[13px] font-semibold text-trail-muted">Météo journée</h3>
      </div>
      <div className="flex-1 grid grid-cols-4 gap-1.5 content-center">
        {PERIODS.map((p) => (
          <div key={p.h} className="rounded-[8px] py-1.5 text-center bg-trail-surface">
            <p className="text-[10px] text-trail-muted">{p.h}</p>
            <p className="text-[18px] leading-none mt-1">{p.icon}</p>
            <p className="text-[16px] leading-none mt-1 text-trail-text" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>—°</p>
          </div>
        ))}
      </div>
    </div>
  )
}
