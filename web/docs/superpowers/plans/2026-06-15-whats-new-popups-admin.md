# Module admin « Quoi de neuf » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de créer des pop-ups « Quoi de neuf » et de les activer/désactiver depuis le panneau admin, le contenu venant désormais de la base au lieu d'être codé en dur.

**Architecture:** Une table `whats_new_popups` (une seule ligne active à la fois) remplace les constantes en dur. Le `WhatsNewModal` lit la ligne active via le client navigateur (borné par RLS) ; un onglet admin gère le CRUD via des routes `/api/admin/whats-new/*` (service role). Un composant présentationnel `WhatsNewCard` est la source unique du rendu (modal + aperçu admin).

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (`@supabase/ssr`), Tailwind, Jest.

**Spec:** `web/docs/superpowers/specs/2026-06-15-whats-new-popups-admin-design.md`

**Rappels projet :**
- Toutes les commandes outillage (`jest`, `tsc`, `lint`) se lancent depuis `web/` en chemin absolu : `cd "c:/Users/Franc/app-run-mobile/web" && …`.
- Pas de `next build` local (conflit `.next` si un `next dev` tourne) : vérifier via `tsc --noEmit` + `lint` + `jest`. Le build autoritatif est sur Vercel.
- La migration 042 n'est **pas** auto-appliquée : à rappeler à Franck (SQL Editor Supabase).

---

## File Structure

**Créés :**
- `web/supabase/migrations/042_whats_new_popups.sql` — table + index unique partiel + RLS + seed.
- `web/lib/admin/whats-new.ts` — type `Bullet` + helpers purs `normalizeBullets`, `shouldShowPopup`.
- `web/__tests__/lib/admin/whats-new.test.ts` — tests des helpers.
- `web/components/ui/WhatsNewCard.tsx` — rendu présentationnel pur (en-tête, puces, bouton).
- `web/app/api/admin/whats-new/route.ts` — `POST` (création).
- `web/app/api/admin/whats-new/[id]/route.ts` — `PATCH` (édition + toggle), `DELETE`.
- `web/app/(main)/admin/components/TabWhatsNew.tsx` — onglet serveur (liste).
- `web/app/(main)/admin/components/WhatsNewManager.tsx` — éditeur client + aperçu.

**Modifiés :**
- `web/components/ui/WhatsNewModal.tsx` — lit la DB, réutilise `WhatsNewCard`.
- `web/app/(main)/admin/page.tsx` — onglet `whats-new`.
- `web/app/(main)/admin/components/TabDashboard.tsx` — carte vers l'onglet.

---

## Task 1: Migration SQL `042_whats_new_popups.sql`

**Files:**
- Create: `web/supabase/migrations/042_whats_new_popups.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Migration: 042 - whats_new_popups
-- Pop-ups « Quoi de neuf » pilotées par l'admin. Une seule active à la fois.
-- Le contenu remplace les constantes codées en dur de WhatsNewModal.tsx.
create table if not exists whats_new_popups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  bullets     jsonb not null default '[]'::jsonb,  -- [{ "emoji": "✨", "label": "…" }]
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Au plus une pop-up active (en plus de la logique applicative).
create unique index if not exists whats_new_popups_one_active
  on whats_new_popups (is_active) where is_active;

alter table whats_new_popups enable row level security;

-- Le modal (client navigateur, authentifié) ne lit QUE la ligne active.
drop policy if exists "read active popup" on whats_new_popups;
create policy "read active popup"
  on whats_new_popups for select
  to authenticated
  using (is_active = true);
-- Aucune policy insert/update/delete → seules les routes admin (service role) écrivent.

-- Seed : la pop-up « Deep Mission » actuelle, désactivée (déjà vue par la plupart).
insert into whats_new_popups (title, bullets, is_active) values (
  'Quoi de neuf',
  '[
    {"emoji":"✨","label":"Nouveau design « Deep Mission » : interface rafraîchie et plus lisible"},
    {"emoji":"🎨","label":"Une couleur par sport : course en orange, vélo en vert, natation en bleu"},
    {"emoji":"🔤","label":"Nouvelle typographie : titres et chiffres plus nets"},
    {"emoji":"🌗","label":"Thèmes clair et sombre peaufinés"}
  ]'::jsonb,
  false
);
```

- [ ] **Step 2: Commit**

```bash
git add web/supabase/migrations/042_whats_new_popups.sql
git commit -m "feat(admin): migration 042 — table whats_new_popups + seed"
```

---

## Task 2: Helpers purs + tests (TDD)

**Files:**
- Create: `web/lib/admin/whats-new.ts`
- Test: `web/__tests__/lib/admin/whats-new.test.ts`

- [ ] **Step 1: Écrire le test (échoue)**

`web/__tests__/lib/admin/whats-new.test.ts` :

```ts
import { normalizeBullets, shouldShowPopup } from '@/lib/admin/whats-new'

describe('normalizeBullets', () => {
  it('garde les puces valides et trim emoji/label', () => {
    expect(normalizeBullets([{ emoji: ' ✨ ', label: '  Nouveau  ' }]))
      .toEqual([{ emoji: '✨', label: 'Nouveau' }])
  })

  it('rejette label vide, non-objets, et autorise emoji vide', () => {
    expect(normalizeBullets([{ emoji: '✨', label: '' }, null, 'x', { emoji: '✨' }]))
      .toEqual([])
    expect(normalizeBullets([{ label: 'Sans emoji' }]))
      .toEqual([{ emoji: '', label: 'Sans emoji' }])
  })

  it('renvoie [] pour une entrée non-array', () => {
    expect(normalizeBullets('nope')).toEqual([])
    expect(normalizeBullets(undefined)).toEqual([])
  })
})

describe('shouldShowPopup', () => {
  it('faux quand aucune pop-up active', () => {
    expect(shouldShowPopup(null, 'x')).toBe(false)
    expect(shouldShowPopup(undefined, undefined)).toBe(false)
  })

  it("vrai quand l'id actif diffère du seen (ou seen absent)", () => {
    expect(shouldShowPopup({ id: 'abc' }, 'xyz')).toBe(true)
    expect(shouldShowPopup({ id: 'abc' }, undefined)).toBe(true)
  })

  it('faux quand déjà vu (id égal)', () => {
    expect(shouldShowPopup({ id: 'abc' }, 'abc')).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd "c:/Users/Franc/app-run-mobile/web" && npx jest __tests__/lib/admin/whats-new.test.ts`
Expected: FAIL — `Cannot find module '@/lib/admin/whats-new'`.

- [ ] **Step 3: Écrire l'implémentation**

`web/lib/admin/whats-new.ts` :

```ts
export type Bullet = { emoji: string; label: string }

/**
 * Valide/normalise une liste de puces (formulaire admin ou payload API).
 * Garde uniquement les entrées { emoji, label } avec un label non vide (après trim).
 * L'emoji est optionnel.
 */
export function normalizeBullets(input: unknown): Bullet[] {
  if (!Array.isArray(input)) return []
  const out: Bullet[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const emoji = typeof rec.emoji === 'string' ? rec.emoji.trim() : ''
    const label = typeof rec.label === 'string' ? rec.label.trim() : ''
    if (!label) continue
    out.push({ emoji, label })
  }
  return out
}

/** Le modal s'affiche s'il existe une pop-up active non encore vue par l'utilisateur. */
export function shouldShowPopup(
  active: { id: string } | null | undefined,
  seenId: unknown,
): boolean {
  return !!active && seenId !== active.id
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd "c:/Users/Franc/app-run-mobile/web" && npx jest __tests__/lib/admin/whats-new.test.ts`
Expected: PASS (3 + 3 assertions).

- [ ] **Step 5: Commit**

```bash
git add web/lib/admin/whats-new.ts web/__tests__/lib/admin/whats-new.test.ts
git commit -m "feat(admin): helpers normalizeBullets + shouldShowPopup (testés)"
```

---

## Task 3: `WhatsNewCard` + refactor `WhatsNewModal`

**Files:**
- Create: `web/components/ui/WhatsNewCard.tsx`
- Modify: `web/components/ui/WhatsNewModal.tsx`

- [ ] **Step 1: Créer le composant présentationnel**

`web/components/ui/WhatsNewCard.tsx` :

```tsx
import { Sparkles } from 'lucide-react'
import type { Bullet } from '@/lib/admin/whats-new'

// Rendu pur de la carte « Quoi de neuf ». Source unique partagée par le modal
// (avec portail + overlay) et l'aperçu live de l'admin (onDismiss absent).
export function WhatsNewCard({
  title,
  bullets,
  onDismiss,
}: {
  title: string
  bullets: Bullet[]
  onDismiss?: () => void
}) {
  return (
    <div className="w-full rounded-[16px] bg-trail-card border border-trail-border p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-trail-primary/15 shrink-0">
          <Sparkles className="text-trail-primary" size={18} />
        </span>
        <h2 className="text-[17px] font-bold text-trail-text font-display">
          {title || 'Quoi de neuf'}
        </h2>
      </div>

      <ul className="space-y-2.5">
        {bullets.map(({ emoji, label }, i) => (
          <li key={i} className="flex gap-2.5 text-body-sm text-trail-text leading-relaxed">
            <span aria-hidden className="shrink-0">{emoji}</span>
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onDismiss}
        className="mt-5 w-full rounded-[10px] bg-trail-primary py-2.5 text-body font-semibold text-white hover:bg-trail-primary-dim transition-colors"
      >
        Compris
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Réécrire `WhatsNewModal` pour lire la DB**

Remplacer **tout** le contenu de `web/components/ui/WhatsNewModal.tsx` par :

```tsx
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
```

- [ ] **Step 3: Vérifier types + lint**

Run: `cd "c:/Users/Franc/app-run-mobile/web" && npx tsc --noEmit && npm run lint`
Expected: aucune erreur sur `WhatsNewCard.tsx` / `WhatsNewModal.tsx`.

- [ ] **Step 4: Commit**

```bash
git add web/components/ui/WhatsNewCard.tsx web/components/ui/WhatsNewModal.tsx
git commit -m "refactor(whats-new): modal lit la pop-up active en base + carte présentationnelle partagée"
```

---

## Task 4: Routes API admin

**Files:**
- Create: `web/app/api/admin/whats-new/route.ts`
- Create: `web/app/api/admin/whats-new/[id]/route.ts`

- [ ] **Step 1: Route collection (`POST`)**

`web/app/api/admin/whats-new/route.ts` :

```ts
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { createServiceClient } from '@/lib/database/supabase-server'
import { normalizeBullets } from '@/lib/admin/whats-new'

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const bullets = normalizeBullets(body?.bullets)
  if (!title || bullets.length === 0) {
    return NextResponse.json({ error: 'Titre et au moins une puce requis' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('whats_new_popups')
    .insert({ title, bullets })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id })
}
```

- [ ] **Step 2: Route élément (`PATCH` + `DELETE`)**

`web/app/api/admin/whats-new/[id]/route.ts` :

```ts
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { createServiceClient } from '@/lib/database/supabase-server'
import { normalizeBullets } from '@/lib/admin/whats-new'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const supabase = createServiceClient()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body?.title === 'string') {
    const title = body.title.trim()
    if (!title) return NextResponse.json({ error: 'Titre vide' }, { status: 400 })
    patch.title = title
  }
  if (body?.bullets !== undefined) {
    const bullets = normalizeBullets(body.bullets)
    if (bullets.length === 0) return NextResponse.json({ error: 'Au moins une puce requise' }, { status: 400 })
    patch.bullets = bullets
  }

  // Activation : une seule active à la fois. Désactiver les autres AVANT d'activer
  // celle-ci (sinon l'index unique partiel whats_new_popups_one_active échoue).
  if (body?.is_active === true) {
    const { error: deactErr } = await supabase
      .from('whats_new_popups')
      .update({ is_active: false })
      .neq('id', id)
    if (deactErr) return NextResponse.json({ error: deactErr.message }, { status: 500 })
    patch.is_active = true
  } else if (body?.is_active === false) {
    patch.is_active = false
  }

  const { error } = await supabase.from('whats_new_popups').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('whats_new_popups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Vérifier types + lint**

Run: `cd "c:/Users/Franc/app-run-mobile/web" && npx tsc --noEmit && npm run lint`
Expected: aucune erreur sur les deux routes.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/admin/whats-new
git commit -m "feat(admin): routes API CRUD whats-new (POST/PATCH/DELETE, garde admin)"
```

---

## Task 5: Onglet admin + branchements

**Files:**
- Create: `web/app/(main)/admin/components/TabWhatsNew.tsx`
- Create: `web/app/(main)/admin/components/WhatsNewManager.tsx`
- Modify: `web/app/(main)/admin/page.tsx`
- Modify: `web/app/(main)/admin/components/TabDashboard.tsx`

- [ ] **Step 1: Onglet serveur (liste)**

`web/app/(main)/admin/components/TabWhatsNew.tsx` :

```tsx
import { createServiceClient } from '@/lib/database/supabase-server'
import { WhatsNewManager } from './WhatsNewManager'
import type { Bullet } from '@/lib/admin/whats-new'

export type PopupRow = {
  id: string
  title: string
  bullets: Bullet[]
  is_active: boolean
  created_at: string
}

export async function TabWhatsNew() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('whats_new_popups')
    .select('id, title, bullets, is_active, created_at')
    .order('created_at', { ascending: false })

  return <WhatsNewManager popups={(data ?? []) as PopupRow[]} />
}
```

- [ ] **Step 2: Éditeur client + aperçu**

`web/app/(main)/admin/components/WhatsNewManager.tsx` :

```tsx
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
```

- [ ] **Step 3: Brancher l'onglet dans `page.tsx`**

Dans `web/app/(main)/admin/page.tsx` :

a) Ajouter l'import après la ligne `import { TabSync } from './components/TabSync'` :

```tsx
import { TabWhatsNew } from './components/TabWhatsNew'
```

b) Remplacer la ligne `VALID_TABS` :

```tsx
const VALID_TABS = ['dashboard', 'users', 'deployments', 'webhooks', 'system', 'sync', 'whats-new'] as const
```

c) Remplacer le bloc `TAB_TITLES` :

```tsx
const TAB_TITLES: Record<Exclude<Tab, 'dashboard'>, string> = {
  users: 'Users',
  deployments: 'Déploiements',
  webhooks: 'Webhooks',
  system: 'Système',
  sync: 'Sync',
  'whats-new': 'Quoi de neuf',
}
```

d) Ajouter le rendu après la ligne `{activeTab === 'sync'        && <TabSync />}` :

```tsx
        {activeTab === 'whats-new'   && <TabWhatsNew />}
```

- [ ] **Step 4: Ajouter la carte dans `TabDashboard.tsx`**

Dans `web/app/(main)/admin/components/TabDashboard.tsx` :

a) Ajouter `Sparkles` à l'import lucide (ligne 6) :

```tsx
import { Users, Plug, Activity, Webhook, Rocket, Settings, Sparkles } from 'lucide-react'
```

b) Ajouter cette carte juste avant la fermeture `</div>` du `grid` (après la carte « Système ») :

```tsx
      <Card href="/admin?tab=whats-new">
        <Sparkles size={18} className="text-trail-primary mb-2" />
        <p className="text-sm font-bold text-trail-text">Quoi de neuf</p>
        <p className="text-xs text-trail-muted mt-0.5">Pop-ups de mise à jour</p>
      </Card>
```

- [ ] **Step 5: Vérifier types + lint**

Run: `cd "c:/Users/Franc/app-run-mobile/web" && npx tsc --noEmit && npm run lint`
Expected: aucune erreur sur les fichiers admin.

- [ ] **Step 6: Commit**

```bash
git add "web/app/(main)/admin"
git commit -m "feat(admin): onglet « Quoi de neuf » (liste + éditeur + aperçu)"
```

---

## Task 6: Vérification finale

- [ ] **Step 1: Tests des helpers**

Run: `cd "c:/Users/Franc/app-run-mobile/web" && npx jest __tests__/lib/admin/whats-new.test.ts`
Expected: PASS.

- [ ] **Step 2: Types + lint global**

Run: `cd "c:/Users/Franc/app-run-mobile/web" && npx tsc --noEmit && npm run lint`
Expected: aucune erreur (warnings i18n pré-existants tolérés).

- [ ] **Step 3: Rappeler la migration à Franck**

Message à afficher : « Migration **042** non auto-appliquée — colle
`web/supabase/migrations/042_whats_new_popups.sql` dans le SQL Editor Supabase
(ou `supabase db push`) **avant** de tester. Tant qu'elle n'est pas appliquée :
le modal n'affiche rien et l'onglet admin lèvera une erreur de lecture. »

- [ ] **Step 4: Vérification visuelle (après migration appliquée)**

1. `/admin?tab=whats-new` → la pop-up « Deep Mission » apparaît, inactive.
2. Créer une nouvelle pop-up → vérifier l'aperçu live, enregistrer.
3. L'activer → vérifier que « Deep Mission » reste inactive (une seule active).
4. Recharger l'app (compte de test, prefs `whats_new_seen` purgées si besoin) →
   la nouvelle pop-up s'affiche ; « Compris » → ne réapparaît plus.

---

## Self-Review (rempli à la rédaction)

- **Couverture spec :** table + index + RLS + seed (T1) ; helpers + tests (T2) ; refactor modal + carte partagée (T3) ; routes CRUD avec activation exclusive (T4) ; onglet + branchements + carte dashboard (T5) ; vérif + rappel migration (T6). ✓
- **Placeholders :** aucun — tout le code est fourni.
- **Cohérence des types :** `Bullet` défini en T2, importé partout (`@/lib/admin/whats-new`). `PopupRow` défini dans `TabWhatsNew`, importé par `WhatsNewManager`. `normalizeBullets`/`shouldShowPopup` utilisés tels que définis.
