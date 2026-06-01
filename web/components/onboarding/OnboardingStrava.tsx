'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

export function OnboardingStrava({ status }: { status?: string }) {
  const O = useT().onboarding
  const router = useRouter()
  const [skipping, setSkipping] = useState(false)

  const errorMsg =
    status === 'already_linked' ? O.errorAlreadyLinked
    : status === 'error'        ? O.errorGeneric
    : null

  async function handleSkip() {
    setSkipping(true)
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_skipped: true }),
      })
    } catch {
      // on navigue vers le dashboard même si la persistance échoue
    } finally {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-trail-bg flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm space-y-7">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FC4C02]/15 border border-[#FC4C02]/30 flex items-center justify-center">
            <Activity size={28} className="text-[#FC4C02]" />
          </div>
          <h1 className="text-2xl font-bold text-trail-text">{O.title}</h1>
          <p className="text-sm text-trail-muted leading-relaxed">{O.subtitle}</p>
        </div>

        {errorMsg && (
          <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5">
            {errorMsg}
          </p>
        )}

        <a
          href="/api/strava/connect?from=onboarding"
          className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-2xl bg-[#FC4C02] hover:bg-[#FC4C02]/90 text-white font-bold uppercase tracking-wider text-sm transition-colors"
        >
          <Activity size={16} />
          {O.connectCta}
        </a>

        <button
          type="button"
          onClick={handleSkip}
          disabled={skipping}
          className="text-sm text-trail-muted underline disabled:opacity-50"
        >
          {skipping ? '…' : O.later}
        </button>
      </div>
    </div>
  )
}
