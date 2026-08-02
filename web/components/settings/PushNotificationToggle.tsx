'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'
import { pushToggleState, type PushToggleState } from '@/lib/push/toggle-state'

// La clé VAPID est distribuée en base64url ; l'API Push attend un Uint8Array.
// Uint8Array.from(...) renvoie un Uint8Array<ArrayBufferLike>, incompatible
// avec le BufferSource (ArrayBuffer) attendu par applicationServerKey depuis
// TS 5.7+ ; new Uint8Array(length) alloue un ArrayBuffer concret et type juste.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function detectIosLike(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function detectStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function PushNotificationToggle() {
  const t = useT()
  // null = pas encore monté : on ne rend rien pour éviter tout écart SSR.
  const [state, setState] = useState<PushToggleState | null>(null)
  const [busy, setBusy] = useState(false)

  // L'état affiché vient TOUJOURS de l'appareil, jamais d'une valeur stockée :
  // un abonnement révoqué par le navigateur apparaît naturellement en OFF.
  const refresh = useCallback(async () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    let subscribed = false
    if (supported) {
      const reg = await navigator.serviceWorker.ready
      subscribed = (await reg.pushManager.getSubscription()) != null
    }
    setState(pushToggleState({
      supported,
      standalone: detectStandalone(),
      iosLike:    detectIosLike(),
      permission: typeof Notification !== 'undefined' ? Notification.permission : null,
      subscribed,
    }))
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const enable = useCallback(async () => {
    setBusy(true)
    try {
      // requestPermission DOIT rester dans le geste utilisateur : Safari
      // rejette toute demande hors handler de clic.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
        ),
      })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } }
      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
    } finally {
      await refresh()
      setBusy(false)
    }
  }, [refresh])

  const disable = useCallback(async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        // Retirer côté serveur AVANT unsubscribe : après, l'endpoint est perdu.
        await fetch('/api/push/subscribe', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
    } finally {
      await refresh()
      setBusy(false)
    }
  }, [refresh])

  if (state === null || state === 'hidden') return null

  const on       = state === 'on'
  const locked   = state === 'denied' || busy
  const notice   =
    state === 'install-required' ? t.settings.pushInstallRequired :
    state === 'denied'           ? t.settings.pushPermissionDenied :
    null

  return (
    <div className="mt-[14px] flex items-start gap-3">
      <div className="w-9 h-9 rounded-[10px] bg-trail-surface flex items-center justify-center flex-shrink-0">
        <Bell size={18} className="text-trail-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-caption font-semibold text-trail-text leading-tight">
          {t.settings.pushMorningLabel}
        </p>
        <p className="text-micro text-trail-muted leading-[15px] mt-[2px]">
          {notice ?? t.settings.pushMorningHint}
        </p>
      </div>
      {state !== 'install-required' && (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t.settings.pushMorningLabel}
          disabled={locked}
          onClick={() => { void (on ? disable() : enable()) }}
          className={
            'relative inline-flex flex-shrink-0 h-[22px] w-[40px] items-center rounded-full transition-colors ' +
            (on ? 'bg-trail-primary' : 'bg-trail-border') +
            (locked ? ' opacity-50' : '')
          }
        >
          <span
            className={
              'inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ' +
              (on ? 'translate-x-[20px]' : 'translate-x-[2px]')
            }
          />
        </button>
      )}
    </div>
  )
}
