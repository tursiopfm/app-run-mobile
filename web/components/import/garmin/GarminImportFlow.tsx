'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { extractSummaries } from '@/lib/garmin-import/unzip'
import { garminSummaryToMapped } from '@/lib/garmin-import/mapper'
import { classifyActivities } from '@/lib/garmin-import/dedup'
import type {
  GarminMapped,
  ConflictItem,
  ExistingActivity,
  ImportReport,
  MapWarning,
} from '@/lib/garmin-import/types'
import { ConflictResolution } from './ConflictResolution'

type State = 'intro' | 'parsing' | 'resolve' | 'committing' | 'done' | 'error'

export function GarminImportFlow() {
  const router = useRouter()
  const [state, setState] = useState<State>('intro')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [nouvelles, setNouvelles] = useState<GarminMapped[]>([])
  const [conflits, setConflits] = useState<ConflictItem[]>([])
  const [report, setReport] = useState<ImportReport | null>(null)
  const [warnings, setWarnings] = useState<MapWarning[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const busy = state === 'parsing' || state === 'committing'
    if (!busy) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [state])

  async function onFile(file: File) {
    setState('parsing')
    setErrorMsg('')
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const summaries = extractSummaries(buf)
      setProgress({ done: 0, total: summaries.length })
      const mapped: GarminMapped[] = []
      const warns: MapWarning[] = []
      for (let i = 0; i < summaries.length; i++) {
        const out = garminSummaryToMapped('me', summaries[i])
        if (out.result) mapped.push(out.result)
        if (out.warning) warns.push(out.warning)
        if (i % 200 === 0) setProgress({ done: i, total: summaries.length })
      }
      setProgress({ done: summaries.length, total: summaries.length })
      setWarnings(warns)
      const dates = mapped.map(m => m.normalized.startTime).sort()
      const params = new URLSearchParams()
      if (dates[0]) params.set('from', dates[0])
      if (dates[dates.length - 1]) params.set('to', dates[dates.length - 1])
      const existing = (await (
        await fetch(`/api/garmin-import/existing?${params}`)
      ).json()) as ExistingActivity[]
      const cls = classifyActivities(mapped, existing)
      setNouvelles(cls.nouvelles)
      setConflits(cls.conflits)
      if (cls.conflits.length === 0) await commit(cls.nouvelles, [])
      else setState('resolve')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Échec du parsing')
      setState('error')
    }
  }

  async function commit(nv: GarminMapped[], cf: ConflictItem[]) {
    setState('committing')
    try {
      const res = await fetch('/api/garmin-import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nouvelles: nv, conflits: cf }),
      })
      const json = (await res.json()) as ImportReport & { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Commit échoué')
      setReport({ ...json, warnings })
      setState('done')
      router.refresh()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Échec du commit')
      setState('error')
    }
  }

  if (state === 'parsing') {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-trail-muted animate-spin" />
          <p className="text-body-sm text-trail-text text-center">
            Analyse des activités : {progress.done} / {progress.total}
          </p>
        </div>
      </div>
    )
  }

  if (state === 'committing') {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-trail-muted animate-spin" />
          <p className="text-body-sm text-trail-text text-center">Import en cours…</p>
        </div>
      </div>
    )
  }

  if (state === 'resolve') {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <ConflictResolution
          conflits={conflits}
          onResolve={resolved => commit(nouvelles, resolved)}
          onCancel={() => setState('intro')}
        />
      </div>
    )
  }

  if (state === 'done' && report) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-trail-muted flex-shrink-0" />
            <p className="text-body-sm font-semibold text-trail-text">Import terminé</p>
          </div>
          <p className="text-body-sm text-trail-text">
            {report.imported} activité{report.imported !== 1 ? 's' : ''} importée{report.imported !== 1 ? 's' : ''}
          </p>
          <p className="text-body-sm text-trail-muted">
            {report.conflictsReplaced} remplacée{report.conflictsReplaced !== 1 ? 's' : ''} par Garmin
          </p>
          <p className="text-body-sm text-trail-muted">
            {report.conflictsKeptStrava} conservée{report.conflictsKeptStrava !== 1 ? 's' : ''} (Strava)
          </p>
          <p className="text-body-sm text-trail-muted">
            {report.warnings.length} avertissement{report.warnings.length !== 1 ? 's' : ''}
          </p>
          {report.periodStart && report.periodEnd && (
            <p className="text-caption text-trail-muted">
              {report.periodStart.slice(0, 10)} → {report.periodEnd.slice(0, 10)}
            </p>
          )}
        </div>
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-[6px] w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
        >
          Voir mon Cockpit
        </Link>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-trail-muted flex-shrink-0 mt-0.5" />
            <p className="text-body-sm text-trail-text">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => setState('intro')}
            className="flex items-center justify-center gap-[6px] w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  // intro (default)
  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>

      <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-3">
        <p className="text-body-sm text-trail-text">
          Garmin fournit un export complet de tes données (RGPD). Demande-le, puis dépose le ZIP ici
          — tout est traité sur ton téléphone, rien n&apos;est envoyé à nos serveurs sauf tes
          activités normalisées.
        </p>
        <p className="text-body-sm text-trail-muted">
          <a
            href="https://www.garmin.com/fr-FR/account/datamanagement/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-trail-text underline"
          >
            Demander mon export Garmin
          </a>
        </p>
        <p className="text-caption text-trail-muted">Délai Garmin : 24–48 h.</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setIsDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) onFile(file)
        }}
        className={[
          'rounded-[10px] border-2 border-dashed px-3 py-8 flex flex-col items-center gap-3 transition-colors',
          isDragging
            ? 'border-trail-text bg-trail-card/60'
            : 'border-trail-border bg-trail-surface',
        ].join(' ')}
      >
        <Upload size={24} className="text-trail-muted" />
        <p className="text-body-sm text-trail-text text-center">
          Glisse ton fichier ZIP ici
        </p>
        <p className="text-caption text-trail-muted">ou</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-[6px] px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
        >
          <Upload size={12} />
          Choisir un fichier .zip
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
