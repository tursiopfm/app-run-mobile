import { AppShell } from '@/components/navigation/AppShell'
import { ExternalLink, ChevronRight, Circle } from 'lucide-react'
import { AccountSection } from '@/components/settings/AccountSection'

export default function SettingsPage() {
  return (
    <AppShell title="Réglages">
      <div className="px-4 py-4 space-y-4">
        {/* Connexions */}
        <section>
          <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">Connexions</p>
          <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
            <div className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-xl bg-[#FC4C02]/15 flex items-center justify-center flex-shrink-0">
                <ExternalLink size={16} className="text-[#FC4C02]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-trail-text">Strava</p>
                <p className="text-xs text-trail-muted">Non connecté</p>
              </div>
              <a
                href="/api/strava/connect"
                className="px-3 py-1.5 rounded-lg bg-[#FC4C02] text-white text-xs font-semibold"
              >
                Connecter
              </a>
            </div>
            {['Garmin', 'Polar', 'Suunto', 'Coros'].map((p) => (
              <div key={p} className="flex items-center gap-3 p-4 opacity-50">
                <Circle size={18} className="text-trail-muted" />
                <p className="text-sm text-trail-text flex-1">{p}</p>
                <span className="text-xs text-trail-muted">Bientôt</span>
              </div>
            ))}
          </div>
        </section>

        {/* Profil athlète */}
        <section>
          <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">Profil athlète</p>
          <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
            {[
              ['FC max',         '185 bpm'],
              ['FC seuil',       '165 bpm'],
              ['Allure seuil',   '5:00/km'],
              ['FTP vélo',       '220 W'  ],
              ['Objectif annuel','3 000 km'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between p-4">
                <p className="text-sm text-trail-text">{label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-trail-muted">{value}</span>
                  <ChevronRight size={14} className="text-trail-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Compte (affiché uniquement si connecté) */}
        <AccountSection />
      </div>
    </AppShell>
  )
}
