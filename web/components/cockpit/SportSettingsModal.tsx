// web/components/cockpit/SportSettingsModal.tsx
'use client'

import { useState } from 'react'
import { SPORT_CONFIG, type SportKey } from '@/lib/design/sports'

type Props = {
  title:      string
  allKeys:    SportKey[]
  visible:    SportKey[]
  defaultKey: SportKey
  onSave:     (visible: SportKey[], defaultKey: SportKey) => void
  onClose:    () => void
}

export function SportSettingsModal({ title, allKeys, visible, defaultKey, onSave, onClose }: Props) {
  const [localVisible, setLocalVisible] = useState<SportKey[]>(visible)
  const [localDefault, setLocalDefault] = useState<SportKey>(defaultKey)

  function toggleVisible(key: SportKey) {
    const next = localVisible.includes(key)
      ? localVisible.filter((k) => k !== key)
      : [...localVisible, key].sort((a, b) => allKeys.indexOf(a) - allKeys.indexOf(b))
    setLocalVisible(next)
    if (!next.includes(localDefault)) {
      setLocalDefault(next[0] ?? key)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-trail-card border border-trail-border rounded-[16px] p-5 w-[320px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold text-trail-text mb-4">{title}</h2>

        <p className="text-[12px] font-semibold text-trail-muted mb-2">Activités à afficher</p>
        <div className="space-y-2 mb-1">
          {allKeys.map((key) => {
            const cfg = SPORT_CONFIG[key]
            return (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localVisible.includes(key)}
                  onChange={() => toggleVisible(key)}
                  className="w-4 h-4"
                />
                <span className="text-[15px]">{cfg.emoji}</span>
                <span className="text-[14px] text-trail-text">{cfg.label}</span>
              </label>
            )
          })}
        </div>
        <p className="text-[11px] text-trail-muted mb-4">Tout décocher masque ce bloc dans le Cockpit</p>

        <p className="text-[12px] font-semibold text-trail-muted mb-1">Activité par défaut</p>
        <p className="text-[11px] text-trail-muted mb-2">Affichée en premier dans le Cockpit</p>
        <div className="space-y-2 mb-5">
          {allKeys.map((key) => {
            const cfg = SPORT_CONFIG[key]
            const isVisible = localVisible.includes(key)
            return (
              <label
                key={key}
                className={`flex items-center gap-3 cursor-pointer ${!isVisible ? 'opacity-40' : ''}`}
              >
                <input
                  type="radio"
                  name="default-sport"
                  value={key}
                  checked={localDefault === key}
                  onChange={() => setLocalDefault(key)}
                  disabled={!isVisible}
                  className="w-4 h-4"
                />
                <span className="text-[15px]">{cfg.emoji}</span>
                <span className="text-[14px] text-trail-text">{cfg.label}</span>
              </label>
            )
          })}
        </div>

        <button
          onClick={() => onSave(localVisible, localDefault)}
          disabled={localVisible.length === 0}
          className={`w-full py-2 rounded-[10px] bg-trail-primary text-white font-semibold text-[14px] ${localVisible.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}
