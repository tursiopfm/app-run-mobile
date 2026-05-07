'use client'

import { useState, useEffect } from 'react'
import { colors } from '@/lib/design/colors'

export type ProfileSource = 'manual' | 'auto'
const STORAGE_KEY = 'tc_profile_source'

type Option = { value: ProfileSource; label: string; desc: string }
const OPTIONS: Option[] = [
  {
    value: 'manual',
    label: 'Je renseigne mes valeurs',
    desc:  'Les champs du profil sont utilisés directement pour calculer tes zones.',
  },
  {
    value: 'auto',
    label: 'Déduire automatiquement',
    desc:  "L'app complète les valeurs manquantes avec l'âge ou l'historique disponible.",
  },
]

export function ProfileSourceSection() {
  const [source, setSource] = useState<ProfileSource>('manual')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'manual' || saved === 'auto') setSource(saved)
  }, [])

  function select(v: ProfileSource) {
    setSource(v)
    localStorage.setItem(STORAGE_KEY, v)
  }

  return (
    <div className="space-y-2">
      {OPTIONS.map(opt => {
        const active = source === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => select(opt.value)}
            className="w-full text-left rounded-[10px] border px-[12px] py-[10px]"
            style={{
              borderColor:     active ? colors.chargeOrange : colors.border,
              backgroundColor: active ? `${colors.chargeOrange}1A` : colors.surface,
              cursor: 'pointer',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex-shrink-0 rounded-full border-2 flex items-center justify-center mt-[2px]"
                style={{ width: 18, height: 18, borderColor: active ? colors.chargeOrange : colors.border }}
              >
                {active && <div className="rounded-full" style={{ width: 9, height: 9, backgroundColor: colors.chargeOrange }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-trail-text">{opt.label}</p>
                <p className="text-[12px] text-trail-muted mt-[2px] leading-[16px]">{opt.desc}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
