'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayISO(): string {
  return localDateISO(new Date())
}

/**
 * Quand l'utilisateur arrive sur /dashboard : si le rapport matinal n'a pas
 * encore été vu aujourd'hui (localStorage `morning_report_seen_YYYY-MM-DD`),
 * redirige automatiquement vers /rapport-matinal. Le rapport marque "vu" au
 * mount, donc une seule redirection par jour.
 *
 * Exception : le jour de la 1ère connexion (= jour où l'onboarding est complété,
 * un nouvel utilisateur ne peut pas atteindre le dashboard avant), on ne
 * redirige pas — l'utilisateur n'a pas encore de data. Le rapport matinal ne
 * s'auto-ouvre donc qu'à partir du lendemain de la 1ère connexion.
 */
export function MorningReportAutoOpen({ onboardingCompletedAt }: { onboardingCompletedAt?: string | null }) {
  const router = useRouter()

  useEffect(() => {
    try {
      const today = todayISO()
      // Pas d'auto-ouverture le jour de la 1ère connexion (onboarding complété).
      if (onboardingCompletedAt && localDateISO(new Date(onboardingCompletedAt)) === today) {
        return
      }
      const key = `morning_report_seen_${today}`
      const seen = localStorage.getItem(key) === '1'
      if (!seen) {
        router.replace('/rapport-matinal')
      }
    } catch {
      // localStorage inaccessible — on laisse l'utilisateur sur /dashboard
    }
  }, [router, onboardingCompletedAt])

  return null
}
