'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, RefreshCw, LogOut } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  isConnected: boolean
  athleteName?: string | null
  planAutoPushTitle: boolean
  notice?: string
}

export function StravaSection({ isConnected, athleteName, planAutoPushTitle, notice }: Props) {
  const router = useRouter()
  const L = useT().settings
  const O = useT().onboarding
  const noticeMsg =
    notice === 'already_linked' ? O.errorAlreadyLinked
    : notice === 'error'        ? O.errorGeneric
    : null
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [autoPush, setAutoPush] = useState<boolean>(planAutoPushTitle)
  const [autoPushSaving, setAutoPushSaving] = useState(false)

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

  async function handleToggleAutoPush() {
    if (autoPushSaving) return
    const next = !autoPush
    setAutoPush(next) // optimistic
    setAutoPushSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_auto_push_title: next }),
      })
      if (!res.ok) {
        setAutoPush(!next) // rollback
      }
    } catch {
      setAutoPush(!next) // rollback
    } finally {
      setAutoPushSaving(false)
    }
  }

  return (
    <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-[10px]">
      {noticeMsg && (
        <p role="alert" className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/25 rounded-[8px] px-3 py-2">
          {noticeMsg}
        </p>
      )}
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

      {isConnected && (
        <div className="flex items-start gap-3 px-1 py-[6px]">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-trail-text leading-tight">
              {L.planAutoPushTitleLabel}
            </p>
            <p className="text-[11px] text-trail-muted leading-[15px] mt-[2px]">
              {L.planAutoPushTitleHint}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoPush}
            aria-label={L.planAutoPushTitleLabel}
            onClick={handleToggleAutoPush}
            disabled={autoPushSaving}
            className={
              'relative inline-flex flex-shrink-0 h-[22px] w-[40px] items-center rounded-full transition-colors disabled:opacity-60 ' +
              (autoPush ? 'bg-trail-primary' : 'bg-trail-border')
            }
          >
            <span
              className={
                'inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ' +
                (autoPush ? 'translate-x-[20px]' : 'translate-x-[2px]')
              }
            />
          </button>
        </div>
      )}

      {syncMsg && (
        <p className="text-[11px] text-trail-muted text-center pt-[2px]">{syncMsg}</p>
      )}
    </div>
  )
}
