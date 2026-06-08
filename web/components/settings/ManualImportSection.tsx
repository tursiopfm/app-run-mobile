'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'

export function ManualImportSection() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [sport, setSport] = useState('Run')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const fd = new FormData()
    fd.append('file', file)
    fd.append('sport', sport)
    fd.append('fileName', file.name)

    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/activities/import-file', { method: 'POST', body: fd })
      const json = (await res.json()) as { saved?: number; error?: string }
      if (res.ok) {
        setMsg('Activité importée ✓')
        router.refresh()
      } else {
        setMsg(json.error ?? 'Import échoué')
      }
    } catch {
      setMsg('Erreur réseau')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-[10px]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[10px] bg-trail-border/40 border border-trail-border flex items-center justify-center flex-shrink-0">
          <Upload size={14} className="text-trail-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-micro font-semibold uppercase tracking-wider text-trail-muted">Import manuel</p>
          <p className="text-body-sm text-trail-text">Importe un fichier .gpx (Garmin, Komoot, Strava…)</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="manual-import-sport" className="text-micro text-trail-muted flex-shrink-0">
          Sport
        </label>
        <select
          id="manual-import-sport"
          value={sport}
          onChange={e => setSport(e.target.value)}
          className="bg-trail-card border border-trail-border rounded-[8px] px-2 py-[6px] text-body-sm text-trail-text flex-1"
        >
          <option value="Run">Course</option>
          <option value="TrailRun">Trail</option>
          <option value="Ride">Vélo</option>
          <option value="Swim">Natation</option>
          <option value="Walk">Marche</option>
          <option value="Hike">Randonnée</option>
        </select>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".gpx"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-busy={busy}
        className="flex items-center justify-center gap-[6px] w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors disabled:opacity-50"
      >
        <Upload size={12} />
        {busy ? 'Import…' : 'Importer un fichier'}
      </button>

      {msg && (
        <p className="text-micro text-trail-muted text-center">{msg}</p>
      )}
    </div>
  )
}
