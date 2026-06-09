'use client'
import { useState } from 'react'
import type { ConflictItem, ConflictDecision } from '@/lib/garmin-import/types'

function providerLabel(p: string): string {
  const map: Record<string, string> = {
    strava: 'Strava', garmin: 'Garmin', gpx: 'GPX', polar: 'Polar',
    suunto: 'Suunto', coros: 'Coros', fit_file: 'Fichier',
  }
  return map[p] ?? p.charAt(0).toUpperCase() + p.slice(1)
}

export function ConflictResolution({
  conflits,
  onResolve,
  onCancel,
}: {
  conflits: ConflictItem[]
  onResolve: (resolved: ConflictItem[]) => void
  onCancel: () => void
}) {
  const [items, setItems] = useState(conflits)
  const setAll = (d: ConflictDecision) => onResolve(items.map(c => ({ ...c, decision: d })))
  const setOne = (i: number, d: ConflictDecision) =>
    setItems(prev => prev.map((c, idx) => (idx === i ? { ...c, decision: d } : c)))

  // Source(s) réelle(s) des doublons : peut être Strava, Garmin (ré-import), GPX…
  const sources = Array.from(new Set(conflits.map(c => providerLabel(c.existing.provider))))
  const sourceClause = sources.length === 1 ? `via ${sources[0]}` : 'dans ton historique'
  const keepLabel = sources.length === 1 ? `Garder mes données ${sources[0]}` : 'Garder mes données existantes'

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-[10px]">
        <p className="text-body-sm text-trail-text">
          <span className="font-semibold">{conflits.length} activité{conflits.length !== 1 ? 's' : ''}</span>{' '}
          {conflits.length !== 1 ? 'existent' : 'existe'} déjà {sourceClause}. Quelle source veux-tu conserver ?
        </p>

        {/* Global actions */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setAll('keep_strava')}
            className="flex items-center justify-center w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
          >
            {keepLabel}
          </button>
          <button
            type="button"
            onClick={() => setAll('replace_garmin')}
            className="flex items-center justify-center w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
          >
            Remplacer par les données Garmin
          </button>
        </div>
      </div>

      {/* Advanced per-item mode */}
      <details className="rounded-[10px] bg-trail-surface px-3 py-[10px]">
        <summary className="cursor-pointer text-trail-muted text-body-sm">
          Choisir activité par activité
        </summary>

        <div className="mt-3 space-y-3">
          {items.map((c, idx) => {
            const g = c.garmin.normalized
            const s = c.existing
            return (
              <div
                key={idx}
                className="rounded-[8px] border border-trail-border bg-trail-card p-3 space-y-2"
              >
                {/* Side-by-side comparison */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Garmin column */}
                  <div className="space-y-[4px]">
                    <p className="text-micro font-semibold uppercase tracking-wider text-trail-muted">
                      Garmin
                    </p>
                    <p className="text-caption text-trail-text">{g.startTime.slice(0, 10)}</p>
                    <p className="text-caption text-trail-text">
                      {((g.distanceM ?? 0) / 1000).toFixed(1)} km
                    </p>
                    <p className="text-caption text-trail-text">
                      {Math.round((g.movingTimeSec ?? 0) / 60)} min
                    </p>
                    <p className="text-caption text-trail-text">
                      {g.elevationGainM != null ? `${g.elevationGainM} m D+` : '—'}
                    </p>
                    <p className="text-caption text-trail-text">
                      {g.avgHr != null ? 'FC ✓' : 'FC —'}
                    </p>
                  </div>

                  {/* Existing source column */}
                  <div className="space-y-[4px]">
                    <p className="text-micro font-semibold uppercase tracking-wider text-trail-muted">
                      {providerLabel(s.provider)}
                    </p>
                    <p className="text-caption text-trail-text">{s.startTime.slice(0, 10)}</p>
                    <p className="text-caption text-trail-text">
                      {(s.distanceM / 1000).toFixed(1)} km
                    </p>
                    <p className="text-caption text-trail-text">
                      {Math.round(s.movingTimeSec / 60)} min
                    </p>
                    <p className="text-caption text-trail-text">
                      {s.elevationGainM != null ? `${s.elevationGainM} m D+` : '—'}
                    </p>
                    <p className="text-caption text-trail-text">
                      {s.avgHr != null ? 'FC ✓' : 'FC —'}
                    </p>
                  </div>
                </div>

                {/* Per-item toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOne(idx, 'keep_strava')}
                    className={[
                      'flex-1 px-2 py-[6px] rounded-[8px] border border-trail-border text-caption font-semibold transition-colors',
                      c.decision === 'keep_strava'
                        ? 'bg-trail-border/60 text-trail-text'
                        : 'bg-trail-card text-trail-muted hover:bg-trail-border/40',
                    ].join(' ')}
                  >
                    {providerLabel(s.provider)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOne(idx, 'replace_garmin')}
                    className={[
                      'flex-1 px-2 py-[6px] rounded-[8px] border border-trail-border text-caption font-semibold transition-colors',
                      c.decision === 'replace_garmin'
                        ? 'bg-trail-border/60 text-trail-text'
                        : 'bg-trail-card text-trail-muted hover:bg-trail-border/40',
                    ].join(' ')}
                  >
                    Garmin
                  </button>
                </div>
              </div>
            )
          })}

          {/* Validate advanced choices */}
          <button
            type="button"
            onClick={() => onResolve(items)}
            className="flex items-center justify-center w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
          >
            Valider mes choix
          </button>
        </div>
      </details>

      {/* Cancel */}
      <button
        type="button"
        onClick={onCancel}
        className="w-full text-center text-caption text-trail-muted hover:text-trail-text transition-colors py-1"
      >
        Annuler l&apos;import
      </button>
    </div>
  )
}
