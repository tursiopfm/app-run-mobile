'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'

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
