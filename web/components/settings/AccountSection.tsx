'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, LogOut } from 'lucide-react'
import { createClient } from '@/lib/database/supabase-client'
import { useT } from '@/lib/i18n/I18nProvider'
import { getReadyRegistration, withTimeout } from '@/lib/push/browser'

// Borne le DELETE serveur et le sub.unsubscribe() : sur un réseau qui pend
// (portail captif, 3G qui traîne) plutôt qu'il ne rejette (hors ligne, lui,
// rejette vite), aucun des deux ne doit retarder signOut() au-delà de
// quelques secondes.
const UNSUBSCRIBE_TIMEOUT_MS = 3000

// Un abonnement push est lié à l'ORIGINE du navigateur, pas au compte : s'il
// survit à la déconnexion, le prochain compte connecté sur cet appareil hérite
// silencieusement de l'abonnement du précédent (endpoint réattribué en base
// dès qu'il retouche l'interrupteur — voir POST /api/push/subscribe), et voit
// l'interrupteur déjà « ON » donc n'a aucune raison d'y toucher. On coupe
// l'abonnement AVANT de quitter le compte pour fermer ce cas.
//
// Ceci ne doit JAMAIS faire échouer la déconnexion : SW absent, fetch en
// échec, unsubscribe qui lève — tout est avalé et journalisé, jamais propagé.
async function unsubscribePushBeforeLogout(): Promise<void> {
  try {
    const reg = await getReadyRegistration()
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    try {
      const res = await fetch('/api/push/subscribe', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ endpoint: sub.endpoint }),
        signal:  AbortSignal.timeout(UNSUBSCRIBE_TIMEOUT_MS),
      })
      if (!res.ok) console.error(`DELETE /api/push/subscribe a répondu ${res.status} (déconnexion)`)
    } catch (err) {
      console.error('Échec réseau lors du retrait serveur de l\'abonnement push (déconnexion)', err)
    }
    // Désabonner l'appareil même si le serveur a échoué : la ligne orpheline
    // sera purgée au prochain envoi cron (404/410), et le compte sortant ne
    // doit pas laisser d'abonnement actif derrière lui. Bornée comme le DELETE
    // ci-dessus : sub.unsubscribe() n'a pas d'AbortSignal, withTimeout abandonne
    // l'attente sans annuler l'appel sous-jacent.
    await withTimeout(sub.unsubscribe(), UNSUBSCRIBE_TIMEOUT_MS, false)
  } catch (err) {
    console.error('Échec du désabonnement push à la déconnexion', err)
  }
}

export function AccountSection() {
  const router = useRouter()
  const L = useT().settings
  const [email, setEmail] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    await unsubscribePushBeforeLogout()
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (!email) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] bg-trail-surface">
        <div className="w-10 h-10 rounded-[12px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
          <Mail size={18} className="text-trail-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-micro font-semibold uppercase tracking-wider text-trail-muted">{L.emailLabel}</p>
          <p className="text-body-sm text-trail-text truncate">{email}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-[6px] px-3 py-[6px] rounded-full border border-red-500/25 text-red-400 text-micro font-semibold tracking-wide hover:bg-red-500/10 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <LogOut size={12} />
          {loggingOut ? '…' : L.logoutLabel}
        </button>
      </div>
    </div>
  )
}
