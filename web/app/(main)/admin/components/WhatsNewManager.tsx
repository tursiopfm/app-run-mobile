'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { WhatsNewCard } from '@/components/ui/WhatsNewCard'
import { normalizeBullets, type Bullet } from '@/lib/admin/whats-new'
import type { PopupRow } from './TabWhatsNew'

type Draft = { id: string | null; title: string; bullets: Bullet[] }

export function WhatsNewManager({ popups }: { popups: PopupRow[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true)
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? 'Erreur')
      return false
    }
    return true
  }

  async function save() {
    if (!draft) return
    const title = draft.title.trim()
    const bullets = normalizeBullets(draft.bullets)
    if (!title || bullets.length === 0) { alert('Titre et au moins une puce requis'); return }
    const ok = draft.id
      ? await call(`/api/admin/whats-new/${draft.id}`, 'PATCH', { title, bullets })
      : await call('/api/admin/whats-new', 'POST', { title, bullets })
    if (ok) { setDraft(null); router.refresh() }
  }

  async function toggle(p: PopupRow) {
    const ok = await call(`/api/admin/whats-new/${p.id}`, 'PATCH', { is_active: !p.is_active })
    if (ok) router.refresh()
  }

  async function remove(p: PopupRow) {
    if (!confirm(`Supprimer « ${p.title} » ?`)) return
    const ok = await call(`/api/admin/whats-new/${p.id}`, 'DELETE')
    if (ok) router.refresh()
  }

  function setBullet(i: number, patch: Partial<Bullet>) {
    if (!draft) return
    setDraft({ ...draft, bullets: draft.bullets.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) })
  }
  function addBullet() {
    if (!draft) return
    setDraft({ ...draft, bullets: [...draft.bullets, { emoji: '', label: '' }] })
  }
  function removeBullet(i: number) {
    if (!draft) return
    setDraft({ ...draft, bullets: draft.bullets.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-4">
      {/* Liste des pop-ups */}
      <div className="space-y-2">
        {popups.length === 0 && (
          <p className="text-xs text-trail-muted">Aucune pop-up. Crée la première ci-dessous.</p>
        )}
        {popups.map(p => (
          <div key={p.id} className="bg-trail-card border border-trail-border rounded-2xl p-4 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-trail-text truncate">{p.title}</p>
              <p className="text-micro text-trail-muted mt-0.5">
                {p.bullets.length} puce{p.bullets.length > 1 ? 's' : ''}
              </p>
            </div>
            {p.is_active && (
              <span className="text-micro font-bold uppercase tracking-widest text-trail-success shrink-0">Active</span>
            )}
            <button
              onClick={() => toggle(p)}
              disabled={busy}
              className={`text-xs font-semibold shrink-0 transition-colors disabled:opacity-50 ${p.is_active ? 'text-trail-warning' : 'text-trail-primary'}`}
            >
              {p.is_active ? 'Désactiver' : 'Activer'}
            </button>
            <button
              onClick={() => setDraft({ id: p.id, title: p.title, bullets: p.bullets })}
              disabled={busy}
              className="text-trail-muted hover:text-trail-text shrink-0 disabled:opacity-50"
              aria-label="Éditer"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => remove(p)}
              disabled={busy}
              className="text-trail-muted hover:text-trail-danger shrink-0 disabled:opacity-50"
              aria-label="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Bouton créer */}
      {!draft && (
        <button
          onClick={() => setDraft({ id: null, title: 'Quoi de neuf', bullets: [{ emoji: '✨', label: '' }] })}
          className="flex items-center gap-2 text-sm font-semibold text-trail-primary hover:text-trail-text transition-colors"
        >
          <Plus size={16} /> Nouvelle pop-up
        </button>
      )}

      {/* Formulaire + aperçu */}
      {draft && (
        <div className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-trail-primary">
              {draft.id ? 'Éditer la pop-up' : 'Nouvelle pop-up'}
            </p>
            <button onClick={() => setDraft(null)} className="text-trail-muted hover:text-trail-text" aria-label="Fermer">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-trail-muted">Titre</label>
            <input
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              className="w-full rounded-[10px] bg-trail-bg border border-trail-border px-3 py-2 text-sm text-trail-text"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-trail-muted">Puces</label>
            {draft.bullets.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={b.emoji}
                  onChange={e => setBullet(i, { emoji: e.target.value })}
                  placeholder="✨"
                  className="w-12 text-center rounded-[10px] bg-trail-bg border border-trail-border px-2 py-2 text-sm"
                />
                <input
                  value={b.label}
                  onChange={e => setBullet(i, { label: e.target.value })}
                  placeholder="Description de la nouveauté"
                  className="flex-1 rounded-[10px] bg-trail-bg border border-trail-border px-3 py-2 text-sm text-trail-text"
                />
                <button
                  onClick={() => removeBullet(i)}
                  className="text-trail-muted hover:text-trail-danger shrink-0"
                  aria-label="Retirer la puce"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              onClick={addBullet}
              className="flex items-center gap-1.5 text-xs font-semibold text-trail-primary hover:text-trail-text transition-colors"
            >
              <Plus size={14} /> Ajouter une puce
            </button>
          </div>

          {/* Aperçu live (même rendu que dans l'app) */}
          <div className="space-y-1">
            <label className="text-xs text-trail-muted">Aperçu</label>
            <div className="max-w-sm">
              <WhatsNewCard title={draft.title} bullets={normalizeBullets(draft.bullets)} />
            </div>
          </div>

          <button
            onClick={save}
            disabled={busy}
            className="w-full rounded-[10px] bg-trail-primary py-2.5 text-sm font-semibold text-white hover:bg-trail-primary-dim transition-colors disabled:opacity-50"
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  )
}
