'use client'

import { useState } from 'react'

// ── Options ────────────────────────────────────────────────────────────────

const DISCIPLINE_OPTIONS: { id: string; label: string }[] = [
  { id: 'trail',      label: 'Trail' },
  { id: 'route',      label: 'Route' },
  { id: 'velo',       label: 'Vélo' },
  { id: 'triathlon',  label: 'Triathlon' },
  { id: 'natation',   label: 'Natation' },
]

const MISSION_OPTIONS: { id: string; label: string }[] = [
  { id: 'trail',  label: 'Préparer un trail' },
  { id: 'route',  label: 'Préparer une course sur route' },
  { id: 'charge', label: 'Suivre ma charge' },
  { id: 'libre',  label: 'Progresser sans objectif' },
]

// ── Types ──────────────────────────────────────────────────────────────────

type Props = {
  discipline: string | null
  mission:    string | null
  raceDate:   string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function patchProfile(patch: Record<string, string | null>) {
  try {
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  } catch { /* silent — non-blocking */ }
}

// ── Shared pill button style ───────────────────────────────────────────────

function PillOption({
  label,
  active,
  onClick,
  ariaLabel,
}: {
  label: string
  active: boolean
  onClick: () => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      className={`px-3 py-[7px] rounded-[10px] border text-body-sm font-semibold transition-colors text-left ${
        active
          ? 'border-trail-primary bg-trail-primary/10 text-trail-text'
          : 'border-trail-border bg-trail-card text-trail-muted hover:border-trail-muted hover:text-trail-text'
      }`}
    >
      {label}
    </button>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export function MissionProfileSection({ discipline, mission, raceDate }: Props) {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(discipline)
  const [selectedMission,    setSelectedMission]    = useState<string | null>(mission)
  const [selectedRaceDate,   setSelectedRaceDate]   = useState<string | null>(raceDate)

  const showRaceDate =
    selectedMission === 'trail' || selectedMission === 'route'

  function handleDisciplineChange(id: string) {
    setSelectedDiscipline(id)
    patchProfile({ onboarding_discipline: id })
  }

  function handleMissionChange(id: string) {
    setSelectedMission(id)
    patchProfile({ onboarding_mission: id })
    // If the new mission hides the race date, clear it
    const newShowsDate = id === 'trail' || id === 'route'
    if (!newShowsDate && selectedRaceDate) {
      setSelectedRaceDate(null)
      patchProfile({ onboarding_race_date: null })
    }
  }

  function handleRaceDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value || null
    setSelectedRaceDate(val)
    patchProfile({ onboarding_race_date: val })
  }

  return (
    <div className="space-y-[14px]">

      {/* ── Discipline ── */}
      <div>
        <label className="block text-caption font-semibold text-trail-muted uppercase tracking-[0.1em] mb-[8px] px-1">
          Discipline principale
        </label>
        <div
          className="flex flex-wrap gap-[6px]"
          role="radiogroup"
          aria-label="Discipline principale"
        >
          {DISCIPLINE_OPTIONS.map(opt => (
            <PillOption
              key={opt.id}
              label={opt.label}
              active={selectedDiscipline === opt.id}
              onClick={() => handleDisciplineChange(opt.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Mission / Objectif ── */}
      <div>
        <label className="block text-caption font-semibold text-trail-muted uppercase tracking-[0.1em] mb-[8px] px-1">
          Objectif
        </label>
        <div
          className="flex flex-col gap-[6px]"
          role="radiogroup"
          aria-label="Objectif d'entraînement"
        >
          {MISSION_OPTIONS.map(opt => (
            <PillOption
              key={opt.id}
              label={opt.label}
              active={selectedMission === opt.id}
              onClick={() => handleMissionChange(opt.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Date de course (optionnel, conditionnel) ── */}
      {showRaceDate && (
        <div>
          <label
            htmlFor="race-date-input"
            className="block text-caption font-semibold text-trail-muted uppercase tracking-[0.1em] mb-[8px] px-1"
          >
            Date de course <span className="normal-case font-normal">(optionnel)</span>
          </label>
          <input
            id="race-date-input"
            type="date"
            value={selectedRaceDate ?? ''}
            onChange={handleRaceDateChange}
            aria-label="Date de la course cible"
            className="w-full rounded-[10px] border border-trail-border bg-trail-card px-3 py-[9px] text-body-sm text-trail-text placeholder:text-trail-muted focus:outline-none focus:border-trail-primary transition-colors"
          />
        </div>
      )}

    </div>
  )
}
