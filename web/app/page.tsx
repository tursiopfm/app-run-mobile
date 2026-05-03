import Link from 'next/link'
import { Mountain, Zap, BarChart3, Brain } from 'lucide-react'
import { AppShell } from '@/components/navigation/AppShell'

export default function HomePage() {
  return (
    <AppShell>
      <div className="min-h-screen bg-trail-bg flex flex-col">
        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-16 pb-8">
          <div className="mb-6 w-16 h-16 rounded-2xl bg-trail-primary/20 border border-trail-primary/30 flex items-center justify-center">
            <Mountain className="text-trail-primary" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-trail-text mb-3 tracking-tight">Trail Cockpit</h1>
          <p className="text-trail-muted text-base max-w-xs leading-relaxed">
            Pilotez votre entraînement trail &amp; endurance avec précision
          </p>
          <div className="mt-10 w-full max-w-xs space-y-3">
            <Link
              href="/dashboard"
              className="block w-full py-3.5 px-6 rounded-2xl bg-trail-primary text-white font-semibold text-center text-base active:scale-95 transition-transform"
            >
              Voir le Dashboard
            </Link>
            <Link
              href="/settings"
              className="block w-full py-3.5 px-6 rounded-2xl bg-trail-surface border border-trail-border text-trail-text font-medium text-center text-base"
            >
              Connecter Strava
            </Link>
          </div>
        </div>

        {/* Feature grid */}
        <div className="px-6 pb-16 grid grid-cols-2 gap-3 max-w-lg mx-auto w-full">
          {[
            { icon: BarChart3, title: 'Charge',  desc: 'ATL / CTL / TSB en temps réel' },
            { icon: Zap,        title: 'CES',     desc: 'Score effort multi-sports'      },
            { icon: Brain,      title: 'Coach',   desc: 'Analyse IA de vos séances'      },
            { icon: Mountain,   title: 'Ultra',   desc: 'Préparation ultra trails'        },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-trail-surface border border-trail-border rounded-2xl p-4">
              <Icon className="text-trail-primary mb-2" size={20} />
              <p className="font-semibold text-trail-text text-sm">{title}</p>
              <p className="text-trail-muted text-xs mt-0.5 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
