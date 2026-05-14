> **Status: Implémenté** · Date: 2026-05-11 · Code: `web/components/settings/IdentityCard.tsx`, `web/app/api/profile/avatar/route.ts`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Profile Identity Edit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre l'édition inline du nom/prénom et l'upload d'une photo de profil personnalisée dans `IdentityCard`, avec priorité `profiles.avatar_url` > Strava > fallback icône.

**Architecture:** `IdentityCard` devient un composant client avec état local pour l'édition. Un nouvel endpoint `POST/DELETE /api/profile/avatar` gère l'upload/suppression vers Supabase Storage. La page `/profile` est mise à jour pour récupérer `avatar_url` et calculer la priorité côté serveur.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Storage, @testing-library/react, Jest

---

## File Map

| Action | Fichier | Rôle |
|---|---|---|
| Modify | `web/app/(main)/profile/page.tsx` | Ajouter `avatar_url` au select profiles, calcul priorité avatar |
| Modify | `web/components/settings/IdentityCard.tsx` | Client component : édition inline nom + upload avatar |
| Create | `web/app/api/profile/avatar/route.ts` | POST (upload) + DELETE (reset) avatar |
| Create | `web/__tests__/components/IdentityCard.test.tsx` | Tests composant |

---

## Task 1 : Supabase Storage — bucket avatars (manuel)

**Files:** aucun fichier à modifier — SQL à coller dans le Dashboard Supabase

- [ ] **Step 1: Créer le bucket et les policies dans Supabase**

Ouvrir le Dashboard Supabase → SQL Editor → coller et exécuter :

```sql
-- Bucket public avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Upload par owner
CREATE POLICY "Owner upload avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Update par owner
CREATE POLICY "Owner update avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Suppression par owner
CREATE POLICY "Owner delete avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

- [ ] **Step 2: Vérifier dans Storage > Buckets que "avatars" apparaît**

---

## Task 2 : API route `/api/profile/avatar`

**Files:**
- Create: `web/app/api/profile/avatar/route.ts`

- [ ] **Step 1: Créer le fichier**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${user.id}/avatar.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  const { error: dbError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ url: publicUrl })
}

export async function DELETE(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Vérifier que TypeScript compile sans erreur**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur sur le fichier

- [ ] **Step 3: Commit**

```bash
git add web/app/api/profile/avatar/route.ts
git commit -m "feat(api): add POST/DELETE /api/profile/avatar for avatar upload"
```

---

## Task 3 : Mettre à jour `profile/page.tsx`

**Files:**
- Modify: `web/app/(main)/profile/page.tsx`

- [ ] **Step 1: Ajouter `avatar_url` au select et recalculer `avatarUrl`**

Remplacer la ligne du select profiles (ligne 14) et le calcul de `avatarUrl` (ligne 31) :

```typescript
// Remplacer le select existant :
const { data: profile } = await supabase
  .from('profiles')
  .select('first_name,last_name,avatar_url,max_hr,aerobic_threshold_hr,threshold_hr,resting_hr,ftp_watts,weight_kg,year_goal_km,birth_year,hr_zone_method,hr_zones_custom,hr_method_updated_at')
  .eq('id', user!.id)
  .single()

// Remplacer le calcul avatarUrl (ligne 31) :
const stravaAvatarUrl = athlete?.profile && athlete.profile !== 'avatar/athlete/large.png'
  ? athlete.profile
  : null
const avatarUrl = profile?.avatar_url ?? stravaAvatarUrl ?? null
```

- [ ] **Step 2: Passer `customAvatarUrl` et `stravaAvatarUrl` séparément à `IdentityCard`**

`IdentityCard` aura besoin de savoir si un avatar custom existe (pour afficher le bouton "Retirer"). Modifier les props passées :

```typescript
<IdentityCard
  firstName={firstName}
  lastName={lastName}
  email={user!.email ?? null}
  avatarUrl={avatarUrl}
  hasCustomAvatar={!!profile?.avatar_url}
  accountCreatedAt={user!.created_at ?? null}
/>
```

- [ ] **Step 3: Vérifier compilation TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur

- [ ] **Step 4: Commit**

```bash
git add web/app/(main)/profile/page.tsx
git commit -m "feat(profile): pass avatar_url priority + hasCustomAvatar to IdentityCard"
```

---

## Task 4 : Refactorer `IdentityCard` en composant client éditable

**Files:**
- Modify: `web/components/settings/IdentityCard.tsx`

- [ ] **Step 1: Réécrire entièrement `IdentityCard.tsx`**

```typescript
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Pencil, Camera, X, Check } from 'lucide-react'

type Props = {
  firstName:        string | null
  lastName:         string | null
  email:            string | null
  avatarUrl:        string | null
  hasCustomAvatar:  boolean
  accountCreatedAt: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function IdentityCard({
  firstName, lastName, email, avatarUrl, hasCustomAvatar, accountCreatedAt,
}: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl)
  const [currentHasCustom, setCurrentHasCustom] = useState(hasCustomAvatar)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editFirst, setEditFirst] = useState(firstName ?? '')
  const [editLast, setEditLast]   = useState(lastName ?? '')
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  const [displayFirst, setDisplayFirst] = useState(firstName)
  const [displayLast, setDisplayLast]   = useState(lastName)

  const fullName = [displayFirst, displayLast].filter(Boolean).join(' ').trim() || 'Athlète'

  function handleEditStart() {
    setEditFirst(displayFirst ?? '')
    setEditLast(displayLast ?? '')
    setIsEditing(true)
    setNameStatus('idle')
  }

  function handleCancel() {
    setIsEditing(false)
    setNameStatus('idle')
  }

  async function handleSaveName() {
    setNameStatus('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editFirst || null,
          last_name:  editLast  || null,
        }),
      })
      if (!res.ok) { setNameStatus('error'); return }
      setDisplayFirst(editFirst || null)
      setDisplayLast(editLast  || null)
      setIsEditing(false)
      setNameStatus('idle')
      router.refresh()
    } catch {
      setNameStatus('error')
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json() as { url: string }
        setCurrentAvatarUrl(url)
        setCurrentHasCustom(true)
        router.refresh()
      }
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUploading(true)
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' })
      if (res.ok) {
        setCurrentAvatarUrl(null)
        setCurrentHasCustom(false)
        router.refresh()
      }
    } finally {
      setAvatarUploading(false)
    }
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[12px]">
      <p className="text-[14px] font-bold text-trail-text">Identité</p>

      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => !avatarUploading && fileInputRef.current?.click()}
            className="w-14 h-14 rounded-full overflow-hidden bg-trail-surface border border-trail-border flex items-center justify-center relative group"
            aria-label="Changer la photo de profil"
          >
            {currentAvatarUrl
              ? <img src={currentAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              : <User size={22} className="text-trail-muted" />}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarUploading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={16} className="text-white" />}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* Nom — mode lecture ou édition */}
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="space-y-[6px]">
              <div className="flex gap-[6px]">
                <input
                  type="text"
                  value={editFirst}
                  onChange={e => setEditFirst(e.target.value)}
                  placeholder="Prénom"
                  className="flex-1 min-w-0 rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[4px] text-[14px] text-trail-text outline-none focus:border-trail-primary"
                />
                <input
                  type="text"
                  value={editLast}
                  onChange={e => setEditLast(e.target.value)}
                  placeholder="Nom"
                  className="flex-1 min-w-0 rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[4px] text-[14px] text-trail-text outline-none focus:border-trail-primary"
                />
              </div>
              <div className="flex gap-[6px]">
                <button
                  onClick={handleSaveName}
                  disabled={nameStatus === 'saving'}
                  className="flex items-center gap-1 rounded-[8px] bg-trail-primary px-3 py-[4px] text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <Check size={12} />
                  {nameStatus === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1 rounded-[8px] bg-trail-surface border border-trail-border px-3 py-[4px] text-[12px] text-trail-muted"
                >
                  <X size={12} />
                  Annuler
                </button>
              </div>
              {nameStatus === 'error' && (
                <p className="text-[11px] text-red-500">Erreur — réessayer</p>
              )}
            </div>
          ) : (
            <div className="group flex items-center gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-trail-text truncate">{fullName}</p>
                <p className="text-[12px] text-trail-muted truncate">{email ?? '—'}</p>
              </div>
              <button
                type="button"
                onClick={handleEditStart}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[6px] hover:bg-trail-surface"
                aria-label="Modifier le nom"
              >
                <Pencil size={13} className="text-trail-muted" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Retirer avatar custom */}
      {currentHasCustom && !avatarUploading && (
        <button
          type="button"
          onClick={handleRemoveAvatar}
          className="text-[11px] text-trail-muted underline underline-offset-2"
        >
          Retirer la photo personnalisée
        </button>
      )}

      <div className="grid grid-cols-2 gap-[8px] text-[12px]">
        <div className="rounded-[10px] bg-trail-surface px-3 py-[8px]">
          <p className="text-[10px] uppercase tracking-wider text-trail-muted">Compte créé</p>
          <p className="text-[13px] text-trail-text mt-[2px]">{formatDate(accountCreatedAt)}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-[8px]">
          <p className="text-[10px] uppercase tracking-wider text-trail-muted">Abonnement</p>
          <p className="text-[13px] text-trail-text mt-[2px]">Free</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier compilation TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add web/components/settings/IdentityCard.tsx
git commit -m "feat(profile): editable IdentityCard — inline name edit + avatar upload"
```

---

## Task 5 : Tests `IdentityCard`

**Files:**
- Create: `web/__tests__/components/IdentityCard.test.tsx`

- [ ] **Step 1: Écrire les tests**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IdentityCard } from '@/components/settings/IdentityCard'

const mockRefresh = jest.fn()
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

const defaultProps = {
  firstName: 'Franck',
  lastName: 'Meri',
  email: 'franck@example.com',
  avatarUrl: null,
  hasCustomAvatar: false,
  accountCreatedAt: '2024-01-15T10:00:00Z',
}

beforeEach(() => jest.clearAllMocks())

describe('IdentityCard — mode lecture', () => {
  it('affiche le nom complet', () => {
    render(<IdentityCard {...defaultProps} />)
    expect(screen.getByText('Franck Meri')).toBeInTheDocument()
  })

  it('affiche "Athlète" si aucun nom', () => {
    render(<IdentityCard {...defaultProps} firstName={null} lastName={null} />)
    expect(screen.getByText('Athlète')).toBeInTheDocument()
  })

  it('affiche l\'email', () => {
    render(<IdentityCard {...defaultProps} />)
    expect(screen.getByText('franck@example.com')).toBeInTheDocument()
  })

  it('affiche l\'avatar si avatarUrl fourni', () => {
    render(<IdentityCard {...defaultProps} avatarUrl="https://example.com/avatar.jpg" />)
    const img = screen.getByRole('img', { name: /avatar/i })
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('n\'affiche pas le bouton "Retirer" si pas d\'avatar custom', () => {
    render(<IdentityCard {...defaultProps} hasCustomAvatar={false} />)
    expect(screen.queryByText(/retirer la photo/i)).not.toBeInTheDocument()
  })

  it('affiche le bouton "Retirer" si avatar custom présent', () => {
    render(<IdentityCard {...defaultProps} hasCustomAvatar={true} avatarUrl="https://example.com/a.jpg" />)
    expect(screen.getByText(/retirer la photo/i)).toBeInTheDocument()
  })
})

describe('IdentityCard — édition du nom', () => {
  it('passe en mode édition au clic sur le crayon', () => {
    render(<IdentityCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier le nom/i }))
    expect(screen.getByPlaceholderText('Prénom')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nom')).toBeInTheDocument()
  })

  it('annuler remet en mode lecture sans appel API', () => {
    render(<IdentityCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier le nom/i }))
    fireEvent.click(screen.getByText('Annuler'))
    expect(screen.getByText('Franck Meri')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Prénom')).not.toBeInTheDocument()
  })

  it('sauvegarde le nom via PATCH /api/profile', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock

    render(<IdentityCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier le nom/i }))

    const firstInput = screen.getByPlaceholderText('Prénom')
    fireEvent.change(firstInput, { target: { value: 'François' } })

    fireEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ first_name: 'François', last_name: 'Meri' }),
      }))
    })

    await waitFor(() => {
      expect(screen.getByText('François Meri')).toBeInTheDocument()
    })

    expect(mockRefresh).toHaveBeenCalled()
  })

  it('affiche une erreur si la sauvegarde échoue', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock

    render(<IdentityCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier le nom/i }))
    fireEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() => {
      expect(screen.getByText(/erreur/i)).toBeInTheDocument()
    })
  })
})

describe('IdentityCard — retirer avatar', () => {
  it('appelle DELETE /api/profile/avatar et retire l\'avatar', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock

    render(<IdentityCard {...defaultProps} hasCustomAvatar={true} avatarUrl="https://example.com/a.jpg" />)
    fireEvent.click(screen.getByText(/retirer la photo/i))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/profile/avatar', { method: 'DELETE' })
    })

    await waitFor(() => {
      expect(screen.queryByText(/retirer la photo/i)).not.toBeInTheDocument()
    })

    expect(mockRefresh).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils passent**

```bash
cd web && npx jest __tests__/components/IdentityCard.test.tsx --no-coverage 2>&1 | tail -20
```

Expected:
```
Tests:       X passed, X total
Test Suites: 1 passed, 1 total
```

- [ ] **Step 3: Commit**

```bash
git add web/__tests__/components/IdentityCard.test.tsx
git commit -m "test(profile): add IdentityCard tests — name editing + avatar removal"
```

---

## Task 6 : Vérification manuelle dans le navigateur

- [ ] **Step 1: Lancer le dev server**

```bash
cd web && npm run dev
```

- [ ] **Step 2: Ouvrir `http://localhost:3000/profile` et vérifier :**
  - Le nom/prénom s'affichent en lecture
  - Au hover sur le nom, l'icône crayon apparaît
  - Clic sur le crayon → inputs prénom/nom apparaissent pré-remplis
  - Sauvegarder met à jour le nom affiché
  - Annuler restore les valeurs précédentes
  - Hover sur l'avatar affiche l'icône caméra
  - Clic sur l'avatar ouvre le sélecteur de fichier
  - Après upload, le nouvel avatar s'affiche
  - Le bouton "Retirer la photo personnalisée" apparaît
  - Clic Retirer remet l'avatar Strava (ou l'icône User si pas de Strava)

- [ ] **Step 3: Commit final si adjustements visuels nécessaires**

```bash
git add -p
git commit -m "fix(profile): visual adjustments on IdentityCard"
```
