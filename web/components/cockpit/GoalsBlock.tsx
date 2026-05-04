'use client'

// Goals block with localStorage-persisted targets.
// Mirror of BlockType.Goals (GoalsRun) from DashboardScreen.kt.
// Defaults: weekKm=50, weekDPlus=2000, yearKm=1000.

import { useState, useEffect } from 'react'
import { GoalProgressRow } from '@/components/ui/GoalProgressRow'
import { colors } from '@/lib/design/colors'

const STORAGE_KEY = 'cockpit_goals'

type Goals = {
  weekKm:    number
  weekDPlus: number
  yearKm:    number
}

const DEFAULT_GOALS: Goals = { weekKm: 50, weekDPlus: 2000, yearKm: 1000 }

type Props = {
  weekKm:    number
  weekDPlus: number
  yearKm:    number
}

export function GoalsBlock({ weekKm, weekDPlus, yearKm }: Props) {
  const [goals,   setGoals]   = useState<Goals>(DEFAULT_GOALS)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState<Goals>(DEFAULT_GOALS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setGoals(JSON.parse(stored) as Goals)
    } catch {}
  }, [])

  function openEdit() {
    setDraft(goals)
    setEditing(true)
  }

  function saveGoals() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    setGoals(draft)
    setEditing(false)
  }

  return (
    <>
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <div className="flex items-center justify-between mb-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-semibold text-trail-text">Objectifs —</span>
            <span className="text-[15px] font-semibold" style={{ color: colors.chargeOrange }}>Course 🏃</span>
          </div>
          <button
            onClick={openEdit}
            className="text-trail-muted hover:text-trail-text transition-colors p-0.5"
            aria-label="Modifier les objectifs"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
        <div className="space-y-[10px]">
          <GoalProgressRow label="Distance hebdo"    current={weekKm}    target={goals.weekKm}    unit="km" color={colors.progressRunFg}    />
          <GoalProgressRow label="D+ semaine"        current={weekDPlus} target={goals.weekDPlus} unit="m"  color={colors.progressDPlusFg}  />
          <GoalProgressRow label="Distance annuelle" current={yearKm}    target={goals.yearKm}    unit="km" color={colors.progressVolumeFg} />
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-trail-card border border-trail-border rounded-[12px] p-5 w-full max-w-sm">
            <h3 className="text-[16px] font-bold text-trail-text mb-4">Modifier les objectifs</h3>
            <div className="space-y-4">
              <GoalField label="Km semaine" value={draft.weekKm}    onChange={(v) => setDraft((g) => ({ ...g, weekKm: v }))}    unit="km" />
              <GoalField label="D+ semaine" value={draft.weekDPlus} onChange={(v) => setDraft((g) => ({ ...g, weekDPlus: v }))} unit="m"  />
              <GoalField label="Km année"   value={draft.yearKm}    onChange={(v) => setDraft((g) => ({ ...g, yearKm: v }))}    unit="km" />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setEditing(false)}
                className="text-[14px] text-trail-muted px-4 py-2"
              >
                Annuler
              </button>
              <button
                onClick={saveGoals}
                className="text-[14px] font-semibold px-4 py-2 rounded-[8px]"
                style={{ backgroundColor: colors.chargeOrange, color: '#fff' }}
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function GoalField({
  label, value, onChange, unit,
}: {
  label: string; value: number; onChange: (v: number) => void; unit: string
}) {
  return (
    <div>
      <label className="text-[13px] text-trail-muted block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="flex-1 bg-trail-surface border border-trail-border rounded-[6px] px-3 py-2 text-[15px] text-trail-text focus:outline-none"
        />
        <span className="text-[13px] text-trail-muted w-6">{unit}</span>
      </div>
    </div>
  )
}
