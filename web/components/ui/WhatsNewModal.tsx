'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/database/supabase-client'

// Pop-up « Quoi de neuf » affiché UNE SEULE FOIS par utilisateur.
// L'état « vu » est stocké dans profiles.ui_preferences.whats_new_seen (par
// utilisateur, multi-appareils). Pour ré-afficher au prochain update : bumper
// RELEASE_ID et mettre à jour BULLETS.
//
// IMPORTANT : la clé `whats_new_seen` est aussi listée dans SYNCED_KEYS du
// PreferencesProvider — sinon son flush (qui REMPLACE ui_preferences à partir
// des seules SYNCED_KEYS) effacerait la valeur. Au dismiss on écrit donc à la
// fois localStorage (pour les flushs futurs) ET un update ciblé en base.
const RELEASE_ID = 'deep-mission-2026-06'
const SEEN_KEY = 'whats_new_seen'

const BULLETS: { emoji: string; label: string }[] = [
  { emoji: '✨', label: 'Nouveau design « Deep Mission » : interface rafraîchie et plus lisible' },
  { emoji: '🎨', label: 'Une couleur par sport : course en orange, vélo en vert, natation en bleu' },
  { emoji: '🔤', label: 'Nouvelle typographie : titres et chiffres plus nets' },
  { emoji: '🌗', label: 'Thèmes clair et sombre peaufinés' },
]

export function WhatsNewModal() {
  const [open, setOpen] = useState(false)

  // Décision d'affichage : lecture autoritaire en base (indépendante du timing
  // d'hydratation du PreferencesProvider).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data } = await supabase
          .from('profiles')
          .select('ui_preferences')
          .eq('id', user.id)
          .single()
        const prefs = (data?.ui_preferences ?? {}) as Record<string, unknown>
        if (!cancelled && prefs[SEEN_KEY] !== RELEASE_ID) setOpen(true)
      } catch { /* silencieux : en cas d'échec, on n'affiche rien */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void dismiss() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function dismiss() {
    setOpen(false)
    try {
      // localStorage : pour que les flushs futurs du PreferencesProvider
      // conservent la valeur (clé présente dans SYNCED_KEYS, format JSON).
      localStorage.setItem(SEEN_KEY, JSON.stringify(RELEASE_ID))
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Update ciblé (read-modify-write) pour ne PAS écraser les autres prefs.
      const { data } = await supabase
        .from('profiles')
        .select('ui_preferences')
        .eq('id', user.id)
        .single()
      const prefs = { ...((data?.ui_preferences ?? {}) as Record<string, unknown>), [SEEN_KEY]: RELEASE_ID }
      await supabase.from('profiles').update({ ui_preferences: prefs }).eq('id', user.id)
    } catch { /* silencieux */ }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
      onClick={() => void dismiss()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[16px] bg-trail-card border border-trail-border p-5"
      >
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-trail-primary/15 shrink-0">
            <Sparkles className="text-trail-primary" size={18} />
          </span>
          <h2 id="whatsnew-title" className="text-[17px] font-bold text-trail-text font-display">
            Quoi de neuf
          </h2>
        </div>

        <ul className="space-y-2.5">
          {BULLETS.map(({ emoji, label }) => (
            <li key={label} className="flex gap-2.5 text-body-sm text-trail-text leading-relaxed">
              <span aria-hidden className="shrink-0">{emoji}</span>
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => void dismiss()}
          className="mt-5 w-full rounded-[10px] bg-trail-primary py-2.5 text-body font-semibold text-white hover:bg-trail-primary-dim transition-colors"
        >
          Compris
        </button>
      </div>
    </div>,
    document.body,
  )
}
