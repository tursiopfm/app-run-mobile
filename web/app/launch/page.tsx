'use client'

// Route de démarrage de la PWA (manifest start_url). Page ultra-légère, sans
// requête : elle peint le splash quasi instantanément → le splash OS se lève
// vite → puis redirige vers /dashboard (qui charge derrière l'overlay splash).
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SplashVisual } from '@/components/ui/SplashVisual'

export default function LaunchPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return (
    <main className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: '#0B0F14' }}>
      <SplashVisual />
    </main>
  )
}
