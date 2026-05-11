'use client'

import { useEffect } from 'react'
import { colors } from '@/lib/design/colors'
import { HR_METHODS } from '@/lib/health/hr-method-meta'
import type { HrZoneMethod as Method } from '@/lib/health/hr-zones'

const STORAGE_KEY = 'tc_hr_zone_method'

export function HrZoneMethod({ value, onChange }: { value: Method; onChange: (m: Method) => void }) {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && HR_METHODS.find(m => m.value === saved)) {
      if (saved !== value) onChange(saved as Method)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function select(m: Method) {
    onChange(m)
    localStorage.setItem(STORAGE_KEY, m)
  }

  return (
    <div className="space-y-2">
      {HR_METHODS.map(m => {
        const active = value === m.value
        return (
          <button
            key={m.value}
            onClick={() => select(m.value)}
            className="w-full text-left rounded-[10px] border px-[12px] py-[10px] transition-colors"
            style={{
              borderColor:     active ? m.color : colors.border,
              backgroundColor: active ? `${m.color}1A` : colors.surface,
              cursor: 'pointer',
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex-shrink-0 rounded-full border-2 flex items-center justify-center"
                style={{ width: 18, height: 18, borderColor: active ? m.color : colors.border }}
              >
                {active && <div className="rounded-full" style={{ width: 9, height: 9, backgroundColor: m.color }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-semibold text-trail-text">{m.label}</span>
                  <span className="text-[11px] font-bold px-[6px] py-[1px] rounded-full"
                    style={{ backgroundColor: m.badgeBg, color: m.color }}>
                    {m.badge}
                  </span>
                </div>
                <p className="text-[12px] text-trail-muted mt-[2px] leading-[16px]">{m.description}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
