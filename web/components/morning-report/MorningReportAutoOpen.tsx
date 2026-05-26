'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Quand l'utilisateur arrive sur /dashboard : si le rapport matinal n'a pas
 * encore été vu aujourd'hui (localStorage `morning_report_seen_YYYY-MM-DD`),
 * redirige automatiquement vers /rapport-matinal. Le rapport marque "vu" au
 * mount, donc une seule redirection par jour.
 */
export function MorningReportAutoOpen() {
  const router = useRouter()

  useEffect(() => {
    try {
      const key = `morning_report_seen_${todayISO()}`
      const seen = localStorage.getItem(key) === '1'
      if (!seen) {
        router.replace('/rapport-matinal')
      }
    } catch {
      // localStorage inaccessible — on laisse l'utilisateur sur /dashboard
    }
  }, [router])

  return null
}
