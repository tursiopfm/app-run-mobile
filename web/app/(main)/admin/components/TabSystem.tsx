import { ENV_SECTIONS } from '@/lib/admin/system-env'
import { ResetOnboardingButton } from './ResetOnboardingButton'

export async function TabSystem() {
  return (
    <div className="space-y-4">
      {/* Tests / Dev */}
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-trail-primary">Tests / Dev</p>
          <p className="text-xs text-trail-muted mt-0.5">Outils de test pour ton propre compte</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-trail-muted">Onboarding « Mission Setup »</span>
          <ResetOnboardingButton />
        </div>
      </div>

      {ENV_SECTIONS.map(section => (
        <div key={section.title} className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-3">
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest ${section.color}`}>{section.title}</p>
            <p className="text-xs text-trail-muted mt-0.5">{section.description}</p>
          </div>
          <div className="space-y-2">
            {section.vars.map(varName => {
              const present = !!process.env[varName]
              return (
                <div key={varName} className="flex items-center justify-between">
                  <span className="text-xs text-trail-muted font-mono">{varName}</span>
                  <span className={`text-xs font-semibold ${present ? 'text-trail-success' : 'text-trail-warning'}`}>
                    {present ? '✓' : '⚠ manquant'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Application */}
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-trail-success">Application</p>
          <p className="text-xs text-trail-muted mt-0.5">Informations sur l&apos;environnement d&apos;exécution</p>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Environnement', value: process.env.NODE_ENV ?? '—' },
            { label: 'Next.js',       value: process.env.NEXT_RUNTIME ?? 'nodejs' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-trail-muted">{label}</span>
              <span className="text-xs font-semibold text-trail-accent">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
