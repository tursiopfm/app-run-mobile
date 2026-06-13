'use client'

// Bloc générique « Ton rythme · 4 dernières semaines » — affiché quand
// l'athlète n'a pas encore de course objectif.
// Maquette de référence : Prompts/plan-tab-mission-final-mockup.html (colonne ②).

import { MissionCard } from './cards'
import { useT } from '@/lib/i18n/I18nProvider'
import type { WeeklyVolume } from '@/lib/mission/rhythm'

type Props = {
  weeks: WeeklyVolume[]
  avgKm: number
  onAddRace: () => void
}

export function RythmeCard({ weeks, avgKm, onAddRace }: Props) {
  const M = useT().mission

  const maxKm = Math.max(1, ...weeks.map(w => w.km))
  const n = weeks.length

  return (
    <MissionCard>
      {/* label */}
      <p
        className="text-[10px] uppercase tracking-[0.12em] font-bold mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        {M.rythmeTitle}
      </p>

      {/* barres de volume */}
      <div className="flex items-end gap-2 h-[56px]">
        {weeks.map((w, i) => {
          const isLast = i === n - 1
          const barH = Math.round((w.km / maxKm) * 56)
          return (
            <div
              key={w.weekStart}
              className="flex-1 rounded-t"
              style={{
                height: `${Math.max(3, barH)}px`,
                background: isLast ? 'var(--primary)' : 'var(--ink-500)',
              }}
            />
          )
        })}
      </div>

      {/* étiquettes des semaines */}
      <div className="flex gap-2 mt-1">
        {weeks.map((w, i) => {
          const isLast = i === n - 1
          // S-(n-1-i) pour les barres antérieures, « Cette sem. » pour la dernière
          const label = isLast ? 'Cette sem.' : `S-${n - 1 - i}`
          return (
            <span
              key={w.weekStart}
              className="flex-1 text-center text-[10px]"
              style={{
                color: isLast ? 'var(--primary-text)' : 'var(--text-muted)',
                fontWeight: isLast ? 700 : 400,
              }}
            >
              {label}
            </span>
          )
        })}
      </div>

      {/* ligne résumé */}
      <p className="text-[12px] mt-3" style={{ color: 'var(--text-muted)' }}>
        <span className="font-semibold" style={{ color: 'var(--trail-text)' }}>
          {M.rythmeAvg(avgKm)}
        </span>{' '}
        {M.rythmeHint}
      </p>

      {/* CTA */}
      <button
        type="button"
        className="w-full mt-4 py-2.5 rounded-full text-[13px] font-bold"
        style={{ background: 'var(--primary)', color: 'var(--ink-900)' }}
        onClick={onAddRace}
      >
        {M.rythmeCta}
      </button>
    </MissionCard>
  )
}
