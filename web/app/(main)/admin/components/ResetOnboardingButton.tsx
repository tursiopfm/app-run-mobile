'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { clearCockpitSportSettings } from '@/lib/design/sport-settings'
import { APP_MODE_KEY } from '@/lib/preferences/app-mode'

export function ResetOnboardingButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function reset() {
    setLoading(true)
    const res = await fetch('/api/admin/reset-onboarding', { method: 'POST' })
    if (!res.ok) {
      setLoading(false)
      return
    }
    // Ardoise vierge côté client : le re-jeu réappliquera mode + discipline.
    // (Le serveur a déjà purgé les pendants DB synchronisés.)
    try { localStorage.removeItem(APP_MODE_KEY) } catch { /* private mode */ }
    clearCockpitSportSettings()
    // Le gate onboarding_completed_at est null → /onboarding réaffiche le flow.
    router.push('/onboarding')
  }

  return (
    <button
      onClick={reset}
      disabled={loading}
      className="flex items-center gap-2 text-xs font-semibold text-trail-primary hover:text-trail-text transition-colors disabled:opacity-50"
    >
      <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
      {loading ? 'Réinitialisation…' : 'Rejouer l’onboarding'}
    </button>
  )
}
