'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { GoalProgressRow } from '@/components/ui/GoalProgressRow'
import { SportSettingsModal } from './SportSettingsModal'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import type { SportOverview } from '@/lib/data/dashboard'
import { getCurrentPlan } from '@/lib/plan/storage'
import { resolveWeeklyTarget } from '@/lib/training/phases'

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

// La cible hebdo running issue du plan d'entraînement (phase courante de la
// semaine en cours) sert de défaut pour les sports run/all. Une édition manuelle
// stocke un override en localStorage et reprend la priorité.
function toISO(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function startOfISOWeekUTC(d: Date): Date {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = utc.getUTCDay() || 7
  if (dow !== 1) utc.setUTCDate(utc.getUTCDate() - (dow - 1))
  return utc
}

type Props = { sportOverviews: Record<SportKey, SportOverview>; onHide?: () => void }

export function GoalsBlock({ sportOverviews, onHide }: Props) {
  const [settings,   setSettings]   = useState<Settings>(DEFAULT_SETTINGS)
  const [targets,    setTargets]    = useState<Partial<Record<SportKey, Partial<Goals>>>>({})
  const [planWeekly, setPlanWeekly] = useState<{ km: number; dPlus: number } | null>(null)
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
      const parsedTargets: Partial<Record<SportKey, Partial<Goals>>> = t
        ? (JSON.parse(t) as Partial<Record<SportKey, Partial<Goals>>>)
        : {}
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

  // Charge la cible hebdo issue du plan d'entraînement pour la semaine en cours.
  // Sert de valeur par défaut pour run/all quand le user n'a pas posé d'override.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const plan = await getCurrentPlan()
        if (cancelled || !plan) return
        const now = new Date()
        const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
        const weekStartISO = toISO(startOfISOWeekUTC(todayUTC))
        const phase = plan.phases.find(p => p.startDate <= weekStartISO && weekStartISO <= p.endDate)
        if (!phase) return
        const t = resolveWeeklyTarget(phase, weekStartISO)
        if (!cancelled) setPlanWeekly({ km: t.km, dPlus: t.dPlus })
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  const effectiveGoals = useCallback((sport: SportKey): Goals => {
    const user = targets[sport] ?? {}
    const def = DEFAULT_GOALS[sport]
    const isRunLike = sport === 'run' || sport === 'all'
    return {
      weekKm:    user.weekKm    ?? (isRunLike ? planWeekly?.km    : undefined) ?? def.weekKm,
      weekDPlus: user.weekDPlus ?? (isRunLike ? planWeekly?.dPlus : undefined) ?? def.weekDPlus,
      yearKm:    user.yearKm    ?? def.yearKm,
    }
  }, [targets, planWeekly])

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
    setDraft(effectiveGoals(sport))
    setEditSport(sport)
  }

  function saveEdit() {
    if (!editSport) return
    const sport = editSport
    const isRunLike = sport === 'run' || sport === 'all'
    const fallbackKm    = (isRunLike ? planWeekly?.km    : undefined) ?? DEFAULT_GOALS[sport].weekKm
    const fallbackDPlus = (isRunLike ? planWeekly?.dPlus : undefined) ?? DEFAULT_GOALS[sport].weekDPlus
    const fallbackYear  = DEFAULT_GOALS[sport].yearKm

    // On ne sauve un override que pour les champs qui diffèrent du fallback
    // (plan pour run/all, sinon DEFAULT_GOALS). Si user retape la valeur du
    // plan, on retire l'override et l'affichage suit à nouveau le plan.
    const next: Partial<Goals> = {}
    if (draft.weekKm    !== fallbackKm)    next.weekKm    = draft.weekKm
    if (draft.weekDPlus !== fallbackDPlus) next.weekDPlus = draft.weekDPlus
    if (draft.yearKm    !== fallbackYear)  next.yearKm    = draft.yearKm

    const nextTargets: Partial<Record<SportKey, Partial<Goals>>> = { ...targets }
    if (Object.keys(next).length === 0) {
      delete nextTargets[sport]
    } else {
      nextTargets[sport] = next
    }
    localStorage.setItem(TARGETS_KEY, JSON.stringify(nextTargets))
    setTargets(nextTargets)
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
            const tgt = effectiveGoals(sport)
            return (
              <div
                key={sport}
                className="min-w-full p-[10px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="flex items-center justify-between mb-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-semibold text-trail-muted">Objectifs —</span>
                    <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>
                      {cfg.label}
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
                      className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
                      aria-label="Paramètres"
                    >
                      ⋮
                    </button>
                  </div>
                </div>

                <div className="space-y-[10px]">
                  <GoalProgressRow
                    label="Km semaine"
                    current={sov.weekKm}
                    target={tgt.weekKm}
                    unit="km"
                    color="#FF6B35"
                  />
                  {sport !== 'swim' && (
                    <GoalProgressRow
                      label="D+ semaine"
                      current={sov.weekDPlus}
                      target={tgt.weekDPlus}
                      unit="m"
                      color="#38BDF8"
                    />
                  )}
                  {(() => {
                    const now = new Date()
                    const start = new Date(now.getFullYear(), 0, 1)
                    const dayOfYear = Math.ceil((now.getTime() - start.getTime()) / 86400000)
                    const expectedKm = (tgt.yearKm * dayOfYear) / 365
                    const diff = sov.ytdKm - expectedKm
                    const diffLabel = `${diff >= 0 ? '+' : ''}${Math.round(diff)} km vs objectif`
                    return (
                      <div>
                        <GoalProgressRow
                          label="Km année"
                          current={sov.ytdKm}
                          target={tgt.yearKm}
                          unit="km"
                          color="#4ADE80"
                        />
                        <p className="text-[12px] text-right mt-[3px]" style={{ color: diff >= 0 ? '#4ADE80' : '#ef4444' }}>
                          {diffLabel}
                        </p>
                      </div>
                    )
                  })()}
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

      {editSport && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
          onClick={() => setEditSport(null)}
        >
          <div
            className="bg-trail-card border border-trail-border rounded-[12px] p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
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
        </div>,
        document.body,
      )}
    </>
  )
}

function GoalField({
  label, value, onChange, unit,
}: {
  label: string; value: number; onChange: (v: number) => void; unit: string
}) {
  const [text, setText] = useState<string>(String(value))
  useEffect(() => {
    if ((text === '' ? 0 : Number(text)) !== value) setText(String(value))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label className="text-[13px] text-trail-muted block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            const raw = e.target.value
            const normalized = raw === '' ? '' : raw.replace(/^0+(?=\d)/, '')
            setText(normalized)
            onChange(normalized === '' ? 0 : Number(normalized))
          }}
          className="flex-1 bg-trail-surface border border-trail-border rounded-[6px] px-3 py-2 text-[15px] text-trail-text focus:outline-none"
        />
        <span className="text-[13px] text-trail-muted w-6">{unit}</span>
      </div>
    </div>
  )
}
