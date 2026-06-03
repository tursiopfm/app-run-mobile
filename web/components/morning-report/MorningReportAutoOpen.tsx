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
 * Exception : le jour de l'inscription, l'utilisateur n'a pas encore de data,
 * on ne redirige donc pas — le rapport matinal ne s'auto-ouvre qu'à partir du
 * lendemain de la création du compte.
 */
export function MorningReportAutoOpen({ createdAt }: { createdAt?: string | null }) {
  const router = useRouter()

  useEffect(() => {
    try {
      const today = todayISO()
      // Pas d'auto-ouverture le jour même de l'inscription.
      if (createdAt && localDateISO(new Date(createdAt)) === today) {
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
  }, [router, createdAt])

  return null
}
