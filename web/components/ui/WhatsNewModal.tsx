'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/database/supabase-client'
import { WhatsNewCard } from './WhatsNewCard'
import { shouldShowPopup, type Bullet } from '@/lib/admin/whats-new'

// Pop-up « Quoi de neuf » : contenu piloté par la table whats_new_popups.
// Affichée UNE fois par utilisateur tant qu'elle reste la pop-up active.
// L'état « vu » est stocké dans profiles.ui_preferences.whats_new_seen = popup.id
// (par utilisateur, multi-appareils). Une nouvelle pop-up active (nouvel id) la
// ré-affiche. La clé whats_new_seen est déjà dans SYNCED_KEYS du PreferencesProvider :
// on écrit donc localStorage (flushs futurs) ET un update ciblé en base au dismiss.
const SEEN_KEY = 'whats_new_seen'

type ActivePopup = { id: string; title: string; bullets: Bullet[] }

export function WhatsNewModal() {
  const [popup, setPopup] = useState<ActivePopup | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        // Pop-up active (la RLS ne laisse lire que la ligne is_active = true).
        const { data: active } = await supabase
          .from('whats_new_popups')
          .select('id, title, bullets')
          .eq('is_active', true)
          .maybeSingle()
        if (!active || cancelled) return
        const { data: prof } = await supabase
          .from('profiles')
          .select('ui_preferences')
          .eq('id', user.id)
          .single()
        const prefs = (prof?.ui_preferences ?? {}) as Record<string, unknown>
        if (!cancelled && shouldShowPopup(active, prefs[SEEN_KEY])) {
          setPopup(active as ActivePopup)
        }
      } catch { /* silencieux : en cas d'échec, on n'affiche rien */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!popup) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void dismiss() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup])

  async function dismiss() {
    const seenId = popup?.id
    setPopup(null)
    if (!seenId) return
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seenId))
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('ui_preferences')
        .eq('id', user.id)
        .single()
      const prefs = { ...((data?.ui_preferences ?? {}) as Record<string, unknown>), [SEEN_KEY]: seenId }
      await supabase.from('profiles').update({ ui_preferences: prefs }).eq('id', user.id)
    } catch { /* silencieux */ }
  }

  if (!popup || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quoi de neuf"
      onClick={() => void dismiss()}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
        <WhatsNewCard title={popup.title} bullets={popup.bullets} onDismiss={() => void dismiss()} />
      </div>
    </div>,
    document.body,
  )
}
