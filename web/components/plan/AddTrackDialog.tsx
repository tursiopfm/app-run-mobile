'use client'

import { useState } from 'react'
import type { RaceTrack } from '@/types/plan'

type Props = {
  raceId: string
  open: boolean
  onClose: () => void
  onSaved: (track: RaceTrack) => void
}

export function AddTrackDialog({ raceId, open, onClose, onSaved }: Props) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function send(body: { gpxText: string } | { gpxUrl: string }) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/races/${raceId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Échec de l\'import.')
        return
      }
      const { track } = await res.json()
      onSaved(track as RaceTrack)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const gpxText = await file.text()
    await send({ gpxText })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[14px] bg-trail-card border border-trail-border p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-h2 font-semibold text-trail-text font-display">Ajouter une trace GPX</h3>
        <label className="block">
          <span className="text-caption text-trail-muted">Fichier .gpx</span>
          <input type="file" accept=".gpx,application/gpx+xml" disabled={busy}
            onChange={onFile}
            className="mt-1 block w-full text-body-sm text-trail-text" />
        </label>
        <div className="text-caption text-trail-muted text-center">ou</div>
        <div className="flex gap-2">
          <input type="url" inputMode="url" value={url} disabled={busy}
            onChange={(e) => setUrl(e.target.value)} placeholder="https://…/trace.gpx"
            className="flex-1 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary" />
          <button type="button" disabled={busy || url.trim() === ''}
            onClick={() => send({ gpxUrl: url.trim() })}
            className="px-3 py-2 rounded-[10px] bg-trail-primary text-white text-caption font-semibold disabled:opacity-50">
            {busy ? '…' : 'Importer'}
          </button>
        </div>
        {error && <p className="text-caption text-trail-danger">{error}</p>}
        <button type="button" onClick={onClose} className="w-full text-caption text-trail-muted underline">Annuler</button>
      </div>
    </div>
  )
}
