'use client'

export function WeatherCurrentBlock() {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] flex flex-col">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-[13px] font-semibold text-trail-muted">Là-dehors</h3>
        <span className="text-[14px]">⛅</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className="text-[28px] leading-none text-trail-text" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>—°</p>
      </div>
      <p className="text-[10px] mt-0.5 text-trail-muted">Météo réelle bientôt (Phase 3)</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-3 text-[11px] text-trail-text">
        <div><span className="text-trail-muted">💨</span> — km/h</div>
        <div><span className="text-trail-muted">💧</span> — %</div>
        <div><span className="text-trail-muted">💦</span> — %</div>
        <div><span className="text-trail-muted">🌅</span> —</div>
      </div>
      <div className="flex gap-1.5 mt-2.5">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[12px] font-semibold leading-none border flex-1 justify-center"
          style={{ background: 'rgba(251,191,36,0.12)', color: 'var(--trail-warning)', borderColor: 'rgba(251,191,36,0.35)' }}
        >
          UV —
        </span>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[12px] font-semibold leading-none border flex-1 justify-center"
          style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--trail-success)', borderColor: 'rgba(74,222,128,0.35)' }}
        >
          Air —
        </span>
      </div>
    </div>
  )
}
