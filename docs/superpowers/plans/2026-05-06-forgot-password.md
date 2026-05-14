> **Status: Implémenté** · Date: 2026-05-06 · Code: `web/app/auth/reset/page.tsx`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un flux "Mot de passe oublié" dans les deux formulaires de connexion de Trail Cockpit, avec une page de reset du mot de passe via token Supabase.

**Architecture:** Mode `'forgot'` ajouté inline aux formulaires existants (même pattern que `'login'`/`'signup'`). Une nouvelle page `/auth/reset` gère le callback Supabase en écoutant l'événement `PASSWORD_RECOVERY` via `onAuthStateChange`.

**Tech Stack:** Next.js 14 App Router, Supabase Auth (`resetPasswordForEmail`, `updateUser`, `onAuthStateChange`), React hooks, Tailwind CSS (`trail-*` classes).

---

## Fichiers

| Fichier | Action |
|---|---|
| `web/app/page.tsx` | Modifier — ajout mode `'forgot'` |
| `web/app/login/page.tsx` | Modifier — ajout mode `'forgot'` |
| `web/app/auth/reset/page.tsx` | Créer — page callback reset |

---

### Task 1: Mode `'forgot'` dans `web/app/page.tsx`

**Files:**
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Remplacer le contenu complet de `web/app/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Zap, Brain, Mountain } from 'lucide-react'
import { createClient } from '@/lib/database/supabase-client'

type Mode = 'login' | 'signup' | 'forgot'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

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
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) { setError(error.message); return }
        if (data.session) {
          router.push('/dashboard')
          router.refresh()
        } else {
          setCheckEmail(true)
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        })
        if (error) { setError(error.message); return }
        setForgotSent(true)
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

  if (forgotSent) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-trail-text">Email envoyé</h1>
          <p className="text-sm text-trail-muted">
            Un lien de réinitialisation a été envoyé à{' '}
            <strong className="text-trail-text">{email}</strong>.
          </p>
          <button
            onClick={() => { setForgotSent(false); setMode('login') }}
            className="text-sm text-trail-accent underline"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
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
          {mode !== 'forgot' && (
            <>
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
              {mode === 'login' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null) }}
                    className="text-xs text-trail-accent underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}
            </>
          )}
          <button
            type="submit"
            disabled={loading}
            className="block w-full py-3.5 px-6 rounded-2xl bg-trail-primary text-white font-semibold text-center text-base active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading
              ? (mode === 'forgot' ? 'Envoi…' : mode === 'login' ? 'Connexion…' : 'Création…')
              : (mode === 'forgot' ? 'Envoyer le lien' : mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
          </button>
          <p className="text-xs text-trail-muted text-center">
            {mode === 'login' ? (
              <>Pas encore de compte ?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(null) }} className="text-trail-accent underline">
                  Créer un compte
                </button>
              </>
            ) : mode === 'signup' ? (
              <>Déjà un compte ?{' '}
                <button type="button" onClick={() => { setMode('login'); setError(null) }} className="text-trail-accent underline">
                  Se connecter
                </button>
              </>
            ) : (
              <button type="button" onClick={() => { setMode('login'); setError(null) }} className="text-trail-accent underline">
                Retour à la connexion
              </button>
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
  )
}
```

- [ ] **Step 2: Vérifier que TypeScript compile sans erreur**

```bash
cd web && npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/app/page.tsx
git commit -m "feat(auth): ajout mode forgot password sur page d'accueil"
```

---

### Task 2: Mode `'forgot'` dans `web/app/login/page.tsx`

**Files:**
- Modify: `web/app/login/page.tsx`

- [ ] **Step 1: Remplacer le contenu complet de `web/app/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-client'

type Mode = 'login' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

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
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        })
        if (error) { setError(error.message); return }
        setForgotSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion. Vérifiez votre .env.local.')
    } finally {
      setLoading(false)
    }
  }

  if (forgotSent) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-trail-text">Email envoyé</h1>
          <p className="text-sm text-trail-muted">
            Un lien de réinitialisation a été envoyé à{' '}
            <strong className="text-trail-text">{email}</strong>.
          </p>
          <button
            onClick={() => { setForgotSent(false); setMode('login') }}
            className="text-sm text-trail-accent underline"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-trail-text text-center mb-8">Trail Cockpit</h1>
        <form onSubmit={handleSubmit} className="bg-trail-card border border-trail-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-trail-text">
            {mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}
          </h2>
          {error && (
            <p role="alert" className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="email" className="text-xs text-trail-muted block mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-trail-bg border border-trail-border rounded-xl px-3 py-2.5 text-sm text-trail-text outline-none focus:border-trail-accent"
            />
          </div>
          {mode === 'login' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="password" className="text-xs text-trail-muted">Mot de passe</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null) }}
                  className="text-xs text-trail-accent underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-trail-bg border border-trail-border rounded-xl px-3 py-2.5 text-sm text-trail-text outline-none focus:border-trail-accent"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-trail-primary text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            {loading
              ? (mode === 'login' ? 'Connexion…' : 'Envoi…')
              : (mode === 'login' ? 'Se connecter' : 'Envoyer le lien')}
          </button>
          <p className="text-xs text-trail-muted text-center">
            {mode === 'login' ? (
              <>Pas encore de compte ?{' '}
                <a href="/" className="text-trail-accent underline">Créer un compte</a>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null) }}
                className="text-trail-accent underline"
              >
                Retour à la connexion
              </button>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd web && npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/app/login/page.tsx
git commit -m "feat(auth): ajout mode forgot password sur /login"
```

---

### Task 3: Page de reset `/auth/reset`

**Files:**
- Create: `web/app/auth/reset/page.tsx`

- [ ] **Step 1: Créer le répertoire et le fichier**

Créer `web/app/auth/reset/page.tsx` avec le contenu suivant :

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let recovered = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recovered = true
        setReady(true)
      }
    })

    const timer = setTimeout(() => {
      if (!recovered) setExpired(true)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setError(error.message); return }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setLoading(false)
    }
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-trail-text">Lien expiré</h1>
          <p className="text-sm text-trail-muted">
            Ce lien de réinitialisation est invalide ou a expiré.
          </p>
          <a href="/" className="text-sm text-trail-accent underline">
            Demander un nouveau lien
          </a>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
        <p className="text-sm text-trail-muted">Vérification du lien…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-trail-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-trail-text text-center mb-8">Trail Cockpit</h1>
        <form onSubmit={handleSubmit} className="bg-trail-card border border-trail-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-trail-text">Nouveau mot de passe</h2>
          {error && (
            <p role="alert" className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="password" className="text-xs text-trail-muted block mb-1">Nouveau mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-trail-bg border border-trail-border rounded-xl px-3 py-2.5 text-sm text-trail-text outline-none focus:border-trail-accent"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="text-xs text-trail-muted block mb-1">Confirmer le mot de passe</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-trail-bg border border-trail-border rounded-xl px-3 py-2.5 text-sm text-trail-text outline-none focus:border-trail-accent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-trail-primary text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd web && npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/app/auth/reset/page.tsx
git commit -m "feat(auth): page /auth/reset pour réinitialisation mot de passe"
```

---

### Task 4: Configuration Supabase + test manuel

**Files:** Aucun fichier code — configuration dashboard uniquement.

- [ ] **Step 1: Ajouter l'URL de redirect dans le dashboard Supabase**

Dans **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**, ajouter :
- `http://localhost:3000/auth/reset` (développement)
- `https://<votre-domaine>/auth/reset` (production)

Sans cette étape, le lien dans l'email redirigera vers une URL bloquée par Supabase.

- [ ] **Step 2: Démarrer le serveur de dev**

```bash
cd web && npm run dev
```

- [ ] **Step 3: Test flux complet — demande de reset**

1. Ouvrir `http://localhost:3000`
2. Vérifier que le lien "Mot de passe oublié ?" apparaît sous le champ mot de passe en mode login
3. Cliquer → vérifier que seul le champ email reste visible, le bouton affiche "Envoyer le lien"
4. Saisir un email valide → soumettre
5. Vérifier l'écran de confirmation "Email envoyé à…"
6. Cliquer "Retour à la connexion" → vérifier retour au formulaire normal

- [ ] **Step 4: Test flux complet — page `/login`**

1. Ouvrir `http://localhost:3000/login`
2. Vérifier le lien "Mot de passe oublié ?" inline à côté du label "Mot de passe"
3. Cliquer → formulaire passe en mode "Mot de passe oublié", titre change
4. Même vérifications qu'à l'étape 3

- [ ] **Step 5: Test page `/auth/reset` sans token**

1. Ouvrir directement `http://localhost:3000/auth/reset` (sans token)
2. Après 3 secondes, l'écran "Lien expiré" doit apparaître avec le lien "Demander un nouveau lien"

- [ ] **Step 6: Test page `/auth/reset` avec token réel** *(nécessite email Supabase configuré)*

1. Demander un reset via le formulaire avec un vrai compte
2. Cliquer le lien dans l'email reçu
3. Vérifier que la page affiche "Nouveau mot de passe" avec 2 champs
4. Tester la validation : soumettre avec 2 mots de passe différents → message d'erreur
5. Soumettre avec mots de passe identiques (≥6 caractères) → redirect vers `/dashboard`
6. Se déconnecter et se reconnecter avec le nouveau mot de passe
