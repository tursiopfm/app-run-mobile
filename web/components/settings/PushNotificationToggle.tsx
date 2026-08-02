'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'
import { pushToggleState, type PushToggleState } from '@/lib/push/toggle-state'
import { getReadyRegistration } from '@/lib/push/browser'

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

// NEXT_PUBLIC_* est inlinée au BUILD : son absence est donc statique, pas une
// condition qui varie d'un rendu à l'autre (pas de souci avec les Rules of
// Hooks à la lire ici, avant les hooks du composant).
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

export function PushNotificationToggle() {
  const t = useT()
  // null = pas encore monté : on ne rend rien pour éviter tout écart SSR.
  const [state, setState] = useState<PushToggleState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  // L'état affiché vient TOUJOURS de l'appareil, jamais d'une valeur stockée :
  // un abonnement révoqué par le navigateur apparaît naturellement en OFF.
  const refresh = useCallback(async () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    let subscribed = false
    if (supported) {
      const reg = await getReadyRegistration()
      subscribed = reg != null && (await reg.pushManager.getSubscription()) != null
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
    setError(false)
    // NEXT_PUBLIC_* est inlinée au BUILD : si elle manque, on le sait dès
    // maintenant. Sans cette garde, l'utilisateur accorderait la permission
    // pour rien — un « oui » qu'il ne pourrait plus jamais redonner.
    // Garde redondante avec le rendu (VAPID_PUBLIC_KEY ci-dessous) mais
    // conservée : elle documente l'invariant localement et coûte une ligne.
    if (!VAPID_PUBLIC_KEY) {
      console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY manquante : abonnement push impossible')
      setError(true)
      return
    }
    setBusy(true)
    try {
      // requestPermission DOIT rester dans le geste utilisateur : Safari
      // rejette toute demande hors handler de clic.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      const reg = await getReadyRegistration()
      if (!reg) {
        console.error('Aucun Service Worker actif : abonnement push impossible')
        setError(true)
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } }
      try {
        const res = await fetch('/api/push/subscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        })
        if (!res.ok) throw new Error(`POST /api/push/subscribe a répondu ${res.status}`)
      } catch (err) {
        // Le navigateur est abonné mais le serveur n'a pas la ligne : annuler
        // l'abonnement ramène la vérité de l'appareil à « non abonné », donc
        // refresh() affichera OFF — l'utilisateur voit que l'action n'a pas
        // pris, sans qu'on ait besoin de stocker un état d'échec à part.
        console.error('Échec de l\'enregistrement serveur de l\'abonnement push', err)
        setError(true)
        await sub.unsubscribe()
      }
    } finally {
      await refresh()
      setBusy(false)
    }
  }, [refresh])

  const disable = useCallback(async () => {
    setError(false)
    setBusy(true)
    try {
      const reg = await getReadyRegistration()
      if (!reg) {
        console.error('Aucun Service Worker actif : désabonnement push impossible')
        setError(true)
        return
      }
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        // Retirer côté serveur AVANT unsubscribe : après, l'endpoint est perdu.
        // On désabonne l'appareil même si le serveur échoue : l'utilisateur a
        // demandé l'arrêt des notifications sur CET appareil, et le laisser
        // abonné le priverait de tout moyen de le voir. La ligne orpheline
        // sera purgée au prochain envoi cron (404/410) ; on journalise l'échec
        // ici pour ne pas le rendre muet.
        try {
          const res = await fetch('/api/push/subscribe', {
            method:  'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ endpoint: sub.endpoint }),
          })
          if (!res.ok) {
            console.error(`DELETE /api/push/subscribe a répondu ${res.status}`)
            setError(true)
          }
        } catch (err) {
          console.error('Échec réseau lors du retrait serveur de l\'abonnement push', err)
          setError(true)
        }
        await sub.unsubscribe()
      }
    } finally {
      await refresh()
      setBusy(false)
    }
  }, [refresh])

  // Sans clé VAPID au build, l'abonnement est structurellement impossible :
  // ne rien rendre plutôt qu'afficher un interrupteur mort. Regroupé avec la
  // garde `state` existante (même pattern, pas de rendu tant que non prêt).
  if (!VAPID_PUBLIC_KEY || state === null || state === 'hidden') return null

  const on       = state === 'on'
  const locked   = state === 'denied' || busy
  const notice   =
    state === 'install-required' ? t.settings.pushInstallRequired :
    state === 'denied'           ? t.settings.pushPermissionDenied :
    error                        ? t.settings.pushError :
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
