'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

const POLL_INTERVAL_MS = 10_000
const COMPLETED_DISPLAY_MS = 5_000
const COMPLETED_DISMISSED_KEY = 'strava_import_completed_dismissed'

type ImportStatus = {
  status: 'idle' | 'pending' | 'in_progress' | 'completed' | 'error'
  total: number
  oldestAt: string | null
  startedAt: string | null
  completedAt: string | null
  error: string | null
}

function formatMonth(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function ImportProgressBanner() {
  const [data, setData] = useState<ImportStatus | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [hideCompleted, setHideCompleted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchStatus(): Promise<ImportStatus | null> {
    try {
      const res = await fetch('/api/strava/import-status', { cache: 'no-store' })
      if (!res.ok) return null
      return (await res.json()) as ImportStatus
    } catch {
      return null
    }
  }

  useEffect(() => {
    let cancelled = false

    async function tick() {
      const next = await fetchStatus()
      if (cancelled) return
      setData(next)
      // Stop polling on terminal states OR idle (no Strava connection / never started)
      if (next && (next.status === 'idle' || next.status === 'completed' || next.status === 'error')) {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    tick()
    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (completedTimerRef.current) clearTimeout(completedTimerRef.current)
    }
  }, [])

  // Auto-hide du bandeau "completed" après 5s, persisté en localStorage
  useEffect(() => {
    if (data?.status !== 'completed') return
    const dismissedAt = typeof window !== 'undefined'
      ? window.localStorage.getItem(COMPLETED_DISMISSED_KEY)
      : null
    if (dismissedAt && data.completedAt && dismissedAt === data.completedAt) {
      setHideCompleted(true)
      return
    }
    completedTimerRef.current = setTimeout(() => {
      setHideCompleted(true)
      if (data.completedAt && typeof window !== 'undefined') {
        window.localStorage.setItem(COMPLETED_DISMISSED_KEY, data.completedAt)
      }
    }, COMPLETED_DISPLAY_MS)
  }, [data])

  async function handleRetry() {
    setRetrying(true)
    try {
      await fetch('/api/strava/import-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      })
      const next = await fetchStatus()
      setData(next)
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(async () => {
        const r = await fetchStatus()
        setData(r)
        if (r && (r.status === 'completed' || r.status === 'error')) {
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      }, POLL_INTERVAL_MS)
    } finally {
      setRetrying(false)
    }
  }

  if (!data || data.status === 'idle') return null
  if (data.status === 'completed' && hideCompleted) return null

  const baseClasses = 'sticky top-0 z-40 w-full h-9 flex items-center justify-center gap-2 px-3 text-xs font-medium transition-all duration-300'

  if (data.status === 'pending' || data.status === 'in_progress') {
    return (
      <div className={`${baseClasses} bg-trail-accent/10 text-trail-text`}>
        <Loader2 size={14} className="animate-spin" />
        <span>
          Import Strava — <strong>{data.total}</strong> activité{data.total > 1 ? 's' : ''}
          {data.oldestAt ? ` (remonté jusqu'à ${formatMonth(data.oldestAt)})` : ''}
        </span>
      </div>
    )
  }

  if (data.status === 'completed') {
    return (
      <div className={`${baseClasses} bg-green-500/15 text-green-400`}>
        <CheckCircle2 size={14} />
        <span>Import Strava terminé — {data.total} activité{data.total > 1 ? 's' : ''}</span>
      </div>
    )
  }

  // status === 'error'
  return (
    <div className={`${baseClasses} bg-red-500/15 text-red-400`}>
      <AlertTriangle size={14} />
      <span className="truncate">Import Strava : {data.error ?? 'erreur inconnue'}</span>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="ml-2 px-2 py-0.5 rounded border border-red-400/40 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
      >
        {retrying ? '…' : 'Réessayer'}
      </button>
    </div>
  )
}
