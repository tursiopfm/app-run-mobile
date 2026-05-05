'use client'

import { useState, useEffect, useRef } from 'react'
import { GoalProgressRow } from '@/components/ui/GoalProgressRow'
import { SportSettingsModal } from './SportSettingsModal'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import type { SportOverview } from '@/lib/data/dashboard'

const SETTINGS_KEY = 'cockpit_goals_settings'
const TARGETS_KEY  = 'cockpit_goals_targets'

type Goals = { weekKm: number; weekDPlus: number; yearKm: number }

const DEFAULT_GOALS: Record<SportKey, Goals> = {
  run:  { weekKm: 50,  weekDPlus: 2000, yearKm: 1000 },
  ride: { weekKm: 100, weekDPlus: 2000, yearKm: 3000 },
  swim: { weekKm: 5,   weekDPlus: 0,    yearKm: 150  },
  all:  { weekKm: 150, weekDPlus: 4000, yearKm: 4000 },
}

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }

type Props = { sportOverviews: Record<SportKey, SportOverview>; onHide?: () => void }

export function GoalsBlock({ sportOverviews, onHide }: Props) {
  const [settings,   setSettings]   = useState<Settings>(DEFAULT_SETTINGS)
  const [targets,    setTargets]    = useState<Record<SportKey, Goals>>(DEFAULT_GOALS)
  const [activeIdx,  setActiveIdx]  = useState(0)
  const [showConfig, setShowConfig] = useState(false)
  const [editSport,  setEditSport]  = useState<SportKey | null>(null)
  const [draft,      setDraft]      = useState<Goals>(DEFAULT_GOALS.run)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY)
      const t = localStorage.getItem(TARGETS_KEY)
      const parsed: Settings = s
        ? { ...DEFAULT_SETTINGS, ...(JSON.parse(s) as Partial<Settings>) }
        : DEFAULT_SETTINGS
      const parsedTargets: Record<SportKey, Goals> = t
        ? { ...DEFAULT_GOALS, ...(JSON.parse(t) as Partial<Record<SportKey, Goals>>) }
        : DEFAULT_GOALS
      setSettings(parsed)
      setTargets(parsedTargets)
      const initIdx = Math.max(0, parsed.visible.indexOf(parsed.default))
      if (initIdx > 0) {
        setActiveIdx(initIdx)
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (el) el.scrollLeft = initIdx * el.clientWidth
        })
      }
    } catch {}
  }, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setActiveIdx(Math.round(el.scrollLeft / el.clientWidth))
  }

  function scrollTo(idx: number) {
    const el = scrollRef.current
    if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
    setActiveIdx(idx)
  }

  function saveSettings(visible: SportKey[], def: SportKey) {
    const s: Settings = { visible, default: def }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
    setSettings(s)
    setShowConfig(false)
    const newIdx = Math.max(0, visible.indexOf(def))
    setActiveIdx(newIdx)
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollLeft = newIdx * el.clientWidth
    })
  }

  function openEdit(sport: SportKey) {
    setDraft({ ...DEFAULT_GOALS[sport], ...targets[sport] })
    setEditSport(sport)
  }

  function saveEdit() {
    if (!editSport) return
    const next = { ...targets, [editSport]: draft }
    localStorage.setItem(TARGETS_KEY, JSON.stringify(next))
    setTargets(next)
    setEditSport(null)
  }

  const visibleSports = settings.visible.filter((k) => ALL_SPORT_KEYS.includes(k))

  return (
    <>
      <div className="rounded-[12px] bg-trail-card border border-trail-border overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto"
          style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
        >
          {visibleSports.map((sport) => {
            const cfg = SPORT_CONFIG[sport]
            const sov = sportOverviews[sport]
            const tgt = { ...DEFAULT_GOALS[sport], ...targets[sport] }
            return (
              <div
                key={sport}
                className="min-w-full p-[10px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="flex items-center justify-between mb-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-semibold text-trail-text">Objectifs —</span>
                    <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>
                      {cfg.label} {cfg.emoji}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(sport)}
                      className="text-trail-muted hover:text-trail-text transition-colors p-0.5"
                      aria-label="Modifier les objectifs"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowConfig(true)}
                      className="text-trail-muted hover:text-trail-text transition-colors p-0.5"
                      aria-label="Paramètres"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-[10px]">
                  <GoalProgressRow
                    label="Distance hebdo"
                    current={sov.weekKm}
                    target={tgt.weekKm}
                    unit="km"
                    color={cfg.color}
                  />
                  {sport !== 'swim' && (
                    <GoalProgressRow
                      label="D+ semaine"
                      current={sov.weekDPlus}
                      target={tgt.weekDPlus}
                      unit="m"
                      color={cfg.color}
                    />
                  )}
                  <GoalProgressRow
                    label="Distance annuelle"
                    current={sov.ytdKm}
                    target={tgt.yearKm}
                    unit="km"
                    color={cfg.color}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {visibleSports.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-2">
            {visibleSports.map((sport, i) => (
              <button
                key={sport}
                onClick={() => scrollTo(i)}
                className="rounded-full transition-all"
                style={{
                  width:           i === activeIdx ? 16 : 6,
                  height:          6,
                  backgroundColor: i === activeIdx
                    ? SPORT_CONFIG[visibleSports[activeIdx]].color
                    : 'rgba(255,255,255,0.25)',
                }}
                aria-label={SPORT_CONFIG[sport].label}
              />
            ))}
          </div>
        )}
      </div>

      {showConfig && (
        <SportSettingsModal
          title="Objectifs — sports"
          allKeys={ALL_SPORT_KEYS}
          visible={settings.visible}
          defaultKey={settings.default}
          onSave={saveSettings}
          onClose={() => setShowConfig(false)}
          onHide={onHide}
        />
      )}

      {editSport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-trail-card border border-trail-border rounded-[12px] p-5 w-full max-w-sm">
            <h3 className="text-[16px] font-bold text-trail-text mb-4">
              Objectifs {SPORT_CONFIG[editSport].label} {SPORT_CONFIG[editSport].emoji}
            </h3>
            <div className="space-y-4">
              <GoalField
                label="Km semaine"
                value={draft.weekKm}
                onChange={(v) => setDraft((g) => ({ ...g, weekKm: v }))}
                unit="km"
              />
              {editSport !== 'swim' && (
                <GoalField
                  label="D+ semaine"
                  value={draft.weekDPlus}
                  onChange={(v) => setDraft((g) => ({ ...g, weekDPlus: v }))}
                  unit="m"
                />
              )}
              <GoalField
                label="Km année"
                value={draft.yearKm}
                onChange={(v) => setDraft((g) => ({ ...g, yearKm: v }))}
                unit="km"
              />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setEditSport(null)}
                className="text-[14px] text-trail-muted px-4 py-2"
              >
                Annuler
              </button>
              <button
                onClick={saveEdit}
                className="text-[14px] font-semibold px-4 py-2 rounded-[8px]"
                style={{ backgroundColor: SPORT_CONFIG[editSport].color, color: '#fff' }}
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
