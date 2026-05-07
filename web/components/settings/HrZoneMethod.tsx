'use client'

import { useState, useEffect } from 'react'
import { colors } from '@/lib/design/colors'

const STORAGE_KEY = 'tc_hr_zone_method'

type Method = 'seuils' | 'test30' | 'karvonen' | 'pct_max' | 'auto' | 'custom'

const METHODS: { value: Method; label: string; desc: string; badge: string }[] = [
  {
    value: 'seuils',
    label: 'Seuils physiologiques',
    desc: 'Le plus précis : basé sur les seuils aérobie et anaérobie.',
    badge: 'Excellent',
  },
  {
    value: 'test30',
    label: 'Test terrain 30 minutes',
    desc: 'Très fiable : basé sur un test terrain de 30 minutes.',
    badge: 'Très bien',
  },
  {
    value: 'karvonen',
    label: 'Réserve FC / Karvonen',
    desc: 'Bon compromis : basé sur la FC max et la FC repos.',
    badge: 'Bien',
  },
  {
    value: 'pct_max',
    label: '% FC max',
    desc: 'Simple : basé uniquement sur la FC max.',
    badge: 'Correct',
  },
  {
    value: 'auto',
    label: 'Estimation automatique',
    desc: "Approximation : basée sur l'âge.",
    badge: 'Approximatif',
  },
  {
    value: 'custom',
    label: 'Personnalisé',
    desc: 'Tu définis tes propres zones.',
    badge: '',
  },
]

export function HrZoneMethod() {
  const [method, setMethod] = useState<Method>('seuils')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && METHODS.find(m => m.value === saved)) {
      setMethod(saved as Method)
    }
  }, [])

  function select(m: Method) {
    setMethod(m)
    localStorage.setItem(STORAGE_KEY, m)
  }

  return (
    <div className="space-y-2">
      {METHODS.map(m => {
        const active = method === m.value
        return (
          <button
            key={m.value}
            onClick={() => select(m.value)}
            className="w-full text-left rounded-[10px] border px-[12px] py-[10px]"
            style={{
              borderColor: active ? colors.chargeOrange : colors.border,
              backgroundColor: active ? `${colors.chargeOrange}1A` : colors.surface,
              cursor: 'pointer',
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex-shrink-0 rounded-full border-2 flex items-center justify-center"
                style={{
                  width: 18, height: 18,
                  borderColor: active ? colors.chargeOrange : colors.border,
                }}
              >
                {active && (
                  <div className="rounded-full" style={{ width: 9, height: 9, backgroundColor: colors.chargeOrange }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-semibold text-trail-text">{m.label}</span>
                  {m.badge && (
                    <span className="text-[11px] font-bold px-[6px] py-[1px] rounded-full"
                      style={{ backgroundColor: `${colors.seriesGreen}26`, color: colors.seriesGreen }}>
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-trail-muted mt-[2px] leading-[16px]">{m.desc}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
