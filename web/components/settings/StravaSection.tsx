'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, RefreshCw, LogOut } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  isConnected: boolean
  athleteName?: string | null
}

export function StravaSection({ isConnected, athleteName }: Props) {
  const router = useRouter()
  const L = useT().settings
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const json = (await res.json()) as { saved?: number; error?: string }
      setSyncMsg(
        res.ok
          ? L.syncImportedActivities(json.saved ?? 0)
          : L.syncErrorPrefix(json.error ?? L.syncErrorUnknown)
      )
      if (res.ok) router.refresh()
    } catch {
      setSyncMsg(L.syncErrorNetwork)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/strava/disconnect', { method: 'DELETE' })
      router.refresh()
    } catch {
      setDisconnecting(false)
    }
  }

  return (
    <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-[10px]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[10px] bg-[#FC4C02]/15 border border-[#FC4C02]/30 flex items-center justify-center flex-shrink-0">
          <Activity size={14} className="text-[#FC4C02]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-trail-muted">Strava</p>
          <p className="text-[13px] text-trail-text truncate">
            {isConnected ? (athleteName ?? L.stravaAccountConnected) : L.stravaNoAccount}
          </p>
        </div>
        <span
          className={
            'flex items-center gap-[5px] px-[10px] py-[4px] rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ' +
            (isConnected
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30')
          }
        >
          <span
            className={
              'w-[6px] h-[6px] rounded-full ' +
              (isConnected ? 'bg-emerald-400' : 'bg-amber-400')
            }
          />
          {isConnected ? L.stravaConnected : L.stravaOffline}
        </span>
      </div>

      {isConnected ? (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center justify-center gap-[6px] flex-1 px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-[12px] font-semibold hover:bg-trail-border/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? L.syncShort : L.syncLabel}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-[6px] px-3 py-[6px] rounded-full border border-red-500/25 text-red-400 text-[11px] font-semibold tracking-wide hover:bg-red-500/10 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <LogOut size={12} />
            {disconnecting ? '…' : L.logoutLabel}
          </button>
        </div>
      ) : (
        <a
          href="/api/strava/connect"
          className="flex items-center justify-center gap-2 w-full px-3 py-[8px] rounded-[8px] bg-[#FC4C02] hover:bg-[#FC4C02]/90 text-white text-[12px] font-bold uppercase tracking-wider transition-colors"
        >
          <Activity size={13} />
          {L.stravaConnectMyAccount}
        </a>
      )}

      {syncMsg && (
        <p className="text-[11px] text-trail-muted text-center pt-[2px]">{syncMsg}</p>
      )}
    </div>
  )
}
