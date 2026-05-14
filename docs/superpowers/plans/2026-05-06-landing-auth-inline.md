> **Status: Implémenté** · Date: 2026-05-06 · Code: `web/app/page.tsx`, `web/components/auth/`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Landing page — auth inline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le logo Mountain et les deux boutons de la page d'accueil par le vrai logo de l'app et un formulaire login/signup inline avec toggle.

**Architecture:** `web/app/page.tsx` devient un composant client qui gère l'état `mode: 'login' | 'signup'` et appelle directement Supabase Auth. Le composant `checkEmail` (confirmation email) est intégré inline. La page `/signup` est supprimée.

**Tech Stack:** Next.js 14, React, Supabase JS client, Tailwind CSS

---

### Task 1: Refactoring de `web/app/page.tsx`

**Files:**
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Remplacer le contenu de `web/app/page.tsx`**

Remplacer l'intégralité du fichier par :

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Zap, Brain, Mountain } from 'lucide-react'
import { AppShell } from '@/components/navigation/AppShell'
import { createClient } from '@/lib/database/supabase-client'

type Mode = 'login' | 'signup'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); return }
        router.push('/dashboard')
        router.refresh()
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) { setError(error.message); return }
        if (data.session) {
          router.push('/dashboard')
          router.refresh()
        } else {
          setCheckEmail(true)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-trail-text">Vérifiez votre email</h1>
          <p className="text-sm text-trail-muted">
            Un lien de confirmation a été envoyé à{' '}
            <strong className="text-trail-text">{email}</strong>.
          </p>
          <button
            onClick={() => { setCheckEmail(false); setMode('login') }}
            className="text-sm text-trail-accent underline"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-trail-bg flex flex-col">
        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-16 pb-8">
          <div className="mb-6">
            <img
              src="/icons/icon-192.png"
              alt="Trail Cockpit"
              className="w-16 h-16 rounded-2xl"
            />
          </div>
          <h1 className="text-3xl font-bold text-trail-text mb-3 tracking-tight">Trail Cockpit</h1>
          <p className="text-trail-muted text-base max-w-xs leading-relaxed">
            Pilotez votre entraînement trail &amp; endurance avec précision
          </p>

          {/* Auth form */}
          <form onSubmit={handleSubmit} className="mt-8 w-full max-w-xs space-y-3">
            {error && (
              <p role="alert" className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="Email"
              className="w-full bg-trail-surface border border-trail-border rounded-2xl px-4 py-3 text-sm text-trail-text outline-none focus:border-trail-accent placeholder:text-trail-muted"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={mode === 'signup' ? 6 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="Mot de passe"
              className="w-full bg-trail-surface border border-trail-border rounded-2xl px-4 py-3 text-sm text-trail-text outline-none focus:border-trail-accent placeholder:text-trail-muted"
            />
            <button
              type="submit"
              disabled={loading}
              className="block w-full py-3.5 px-6 rounded-2xl bg-trail-primary text-white font-semibold text-center text-base active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading
                ? (mode === 'login' ? 'Connexion…' : 'Création…')
                : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
            </button>
            <p className="text-xs text-trail-muted text-center">
              {mode === 'login' ? (
                <>Pas encore de compte ?{' '}
                  <button type="button" onClick={() => { setMode('signup'); setError(null) }} className="text-trail-accent underline">
                    Créer un compte
                  </button>
                </>
              ) : (
                <>Déjà un compte ?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(null) }} className="text-trail-accent underline">
                    Se connecter
                  </button>
                </>
              )}
            </p>
          </form>
        </div>

        {/* Feature grid */}
        <div className="px-6 pb-16 grid grid-cols-2 gap-3 max-w-lg mx-auto w-full">
          {[
            { icon: BarChart3, title: 'Charge', desc: 'ATL / CTL / TSB en temps réel' },
            { icon: Zap,       title: 'Effort', desc: 'Score effort multi-sports'     },
            { icon: Brain,     title: 'Coach',  desc: 'Analyse IA de vos séances'     },
            { icon: Mountain,  title: 'Ultra',  desc: 'Préparation ultra trails'       },
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
```

- [ ] **Step 2: Vérifier que le build TypeScript passe**

```bash
cd web && npx tsc --noEmit
```

Expected: aucune erreur TypeScript.

- [ ] **Step 3: Lancer le dev server et vérifier visuellement**

```bash
cd web && npm run dev
```

Ouvrir http://localhost:3000 et vérifier :
- Logo PNG affiché (pas l'icône Mountain)
- Champs email + mot de passe visibles
- Bouton "Se connecter" en orange
- Lien "Créer un compte" → switch du libellé bouton en "Créer mon compte"
- Lien "Déjà un compte ?" → retour mode login
- Grille features avec "Effort" (pas "CES")

- [ ] **Step 4: Commit**

```bash
git add web/app/page.tsx
git commit -m "feat(landing): logo réel + formulaire auth inline, Effort remplace CES"
```

---

### Task 2: Suppression de `/signup`

**Files:**
- Delete: `web/app/signup/page.tsx`

- [ ] **Step 1: Supprimer la page signup**

```bash
rm web/app/signup/page.tsx
```

Vérifier qu'il ne reste rien dans le dossier :

```bash
ls web/app/signup/
```

Expected: dossier vide ou supprimé (selon si d'autres fichiers comme `loading.tsx` existent — ne supprimer que `page.tsx`).

- [ ] **Step 2: Vérifier qu'aucun import ne référence `/signup`**

```bash
grep -r "signup" web/app --include="*.tsx" --include="*.ts" -l
```

Expected: seuls les fichiers légitimes apparaissent (ex: `/login/page.tsx` a un lien `href="/signup"` qui pointera vers 404 — l'accepter ou le mettre à jour en supprimant le lien).

Si `/login/page.tsx` référence `/signup`, mettre à jour le lien pour pointer vers `/` :

Dans `web/app/login/page.tsx`, ligne ~78 :
```tsx
// Avant
<a href="/signup" className="text-trail-accent underline">Créer un compte</a>
// Après
<a href="/" className="text-trail-accent underline">Créer un compte</a>
```

- [ ] **Step 3: Build de vérification**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: build réussi, pas d'erreur sur `/signup`.

- [ ] **Step 4: Commit**

```bash
git add -A web/app/signup/ web/app/login/page.tsx
git commit -m "chore: suppression /signup, auth centralisée sur page d'accueil"
```
