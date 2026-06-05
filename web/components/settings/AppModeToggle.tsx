'use client'

import { useRouter } from 'next/navigation'
import { Compass, BarChart3 } from 'lucide-react'
import { useAppMode, type AppMode } from '@/lib/preferences/app-mode'
import { usePreferences } from '@/lib/preferences/PreferencesProvider'

// Bascule Mode Mission ↔ Expert.
//  - variant "row"     : pour la page Réglages (segmented control + libellés)
//  - variant "compact" : raccourci header/sidebar (un seul bouton qui bascule)
// Persiste immédiatement (flushNow → profiles.ui_preferences) puis router.refresh()
// pour que la nav (SSR) et les pages relisent le mode sans flash.

type Props = { variant?: 'row' | 'compact'; initialMode?: AppMode }

export function AppModeToggle({ variant = 'row', initialMode = 'expert' }: Props) {
  const router = useRouter()
  const { mode, setMode, mounted } = useAppMode(initialMode)
  const { flushNow } = usePreferences()

  async function switchTo(m: AppMode) {
    if (m === mode) return
    setMode(m)
    try { await flushNow() } catch { /* silent */ }
    router.refresh()
  }

  if (variant === 'compact') {
    const next: AppMode = mode === 'mission' ? 'expert' : 'mission'
    const label = mode === 'mission' ? 'Mission' : 'Expert'
    const Icon = mode === 'mission' ? Compass : BarChart3
    return (
      <button
        type="button"
        onClick={() => switchTo(next)}
        aria-label={`Mode ${label} — basculer vers ${next === 'mission' ? 'Mission' : 'Expert'}`}
        title={`Mode ${label}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-trail-border bg-trail-card px-2.5 py-1 text-[11px] font-semibold text-trail-text hover:border-trail-primary transition-colors"
        style={{ visibility: mounted ? 'visible' : 'hidden' }}
      >
        <Icon size={13} className="text-trail-primary" />
        {label}
      </button>
    )
  }

  // variant row
  const opts: { key: AppMode; label: string; desc: string; Icon: typeof Compass }[] = [
    { key: 'mission', label: 'Mission', desc: 'Vue allégée, l’essentiel', Icon: Compass },
    { key: 'expert',  label: 'Expert',  desc: 'Cockpit complet, données avancées', Icon: BarChart3 },
  ]
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode d’affichage">
      {opts.map(({ key, label, desc, Icon }) => {
        const active = mounted && mode === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => switchTo(key)}
            className={`text-left rounded-[12px] border p-3 transition-colors ${
              active
                ? 'border-trail-primary bg-trail-primary/10'
                : 'border-trail-border bg-trail-card hover:border-trail-muted'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon size={16} className={active ? 'text-trail-primary' : 'text-trail-muted'} />
              <span className="text-[14px] font-semibold text-trail-text">{label}</span>
            </span>
            <span className="mt-1 block text-[12px] text-trail-muted leading-snug">{desc}</span>
          </button>
        )
      })}
    </div>
  )
}
