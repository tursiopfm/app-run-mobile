'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink } from 'lucide-react'

type Props = {
  isConnected: boolean
  athleteName?: string | null
}

export function StravaSection({ isConnected, athleteName }: Props) {
  const router = useRouter()
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
          ? `${json.saved ?? 0} activité(s) importée(s)`
          : `Erreur : ${json.error ?? 'inconnue'}`
      )
      if (res.ok) router.refresh()
    } catch {
      setSyncMsg('Erreur réseau')
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
    <div className="flex items-center gap-3 p-4">
      <div className="w-9 h-9 rounded-xl bg-[#FC4C02]/15 flex items-center justify-center flex-shrink-0">
        <ExternalLink size={16} className="text-[#FC4C02]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-trail-text">Strava</p>
        {isConnected ? (
          <p className="text-xs text-green-500">
            Connecté{athleteName ? ` — ${athleteName}` : ''}
          </p>
        ) : (
          <p className="text-xs text-trail-muted">Non connecté</p>
        )}
        {syncMsg && <p className="text-xs text-trail-muted mt-0.5">{syncMsg}</p>}
      </div>
      {isConnected ? (
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1.5 rounded-lg border border-trail-border text-trail-text text-xs font-semibold disabled:opacity-50"
          >
            {syncing ? '…' : 'Sync'}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-semibold disabled:opacity-50"
          >
            {disconnecting ? '…' : 'Déconnecter'}
          </button>
        </div>
      ) : (
        <a
          href="/api/strava/connect"
          className="px-3 py-1.5 rounded-lg bg-[#FC4C02] text-white text-xs font-semibold flex-shrink-0"
        >
          Connecter
        </a>
      )}
    </div>
  )
}
