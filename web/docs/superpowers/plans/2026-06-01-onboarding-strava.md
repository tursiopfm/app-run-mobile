# Onboarding « Connecter Strava » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Après inscription, rediriger un utilisateur sans Strava connecté vers une page `/onboarding` qui propose de connecter Strava (ou de passer définitivement), pour faciliter la première connexion.

**Architecture:** Gate côté serveur dans `/dashboard` (point d'entrée unique de tous les nouveaux comptes) qui redirige vers `/onboarding` tant que Strava n'est pas connecté ET que le flag persistant `profiles.onboarding_skipped` est `false`. La page `/onboarding` (hors groupe `(main)`, plein écran) propose le CTA Strava et un bouton « Plus tard ». Le callback OAuth ramène sur `/dashboard` quand le flux vient de l'onboarding (via cookie `strava_from`).

**Tech Stack:** Next.js 14 App Router (RSC + route handlers), TypeScript, Tailwind, Supabase SSR, i18n maison (`useT()`), Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-01-onboarding-strava-design.md`

**Note sur les tests :** le repo ne teste en unitaire que les composants client et les fonctions `lib/` (aucun harness pour les server components RSC ni les route handlers). On applique donc le TDD strict au composant client `OnboardingStrava` (Task 4) ; les pièces serveur (page RSC, gate dashboard, routes connect/callback) sont du glue mince vérifié par `npm run build` + parcours manuel (Task 8).

---

### Task 1: i18n — namespace `onboarding`

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts` (type `Dict` + const `fr`)
- Modify: `web/lib/i18n/dictionaries/en.ts` (const `en`)

- [ ] **Step 1: Ajouter le bloc au type `Dict` (fr.ts)**

Dans `web/lib/i18n/dictionaries/fr.ts`, le type `Dict` contient un bloc `auth: { … }` qui se termine par `featUltra: string; featUltraDesc: string` puis `  }`, immédiatement suivi de `  install: {`. Insérer le bloc `onboarding` entre la fin de `auth` et `install` :

```ts
    featUltra: string; featUltraDesc: string
  }
  onboarding: {
    title: string
    subtitle: string
    connectCta: string
    later: string
  }
  install: {
```

- [ ] **Step 2: Ajouter les valeurs FR (fr.ts)**

Dans le const `fr`, le bloc de valeurs `auth: { … }` se termine par la ligne `featUltra: 'Ultra', featUltraDesc: 'Préparation ultra trails',` puis `  },`, suivi du commentaire `// --- PWA install prompt ---`. Insérer entre le `},` de `auth` et ce commentaire :

```ts
  },

  onboarding: {
    title:      'Connectez Strava',
    subtitle:   'Importez automatiquement vos activités pour démarrer votre cockpit d’entraînement.',
    connectCta: 'Connecter mon compte Strava',
    later:      'Plus tard',
  },

  // --- PWA install prompt ---
```

- [ ] **Step 3: Ajouter les valeurs EN (en.ts)**

Dans `web/lib/i18n/dictionaries/en.ts`, le const `en` a un bloc `auth: { … }` se terminant par `featUltra: 'Ultra', featUltraDesc: 'Ultra trail preparation',` puis `  },`, suivi de `  install: {`. Insérer entre le `},` de `auth` et `install` :

```ts
  },

  onboarding: {
    title:      'Connect Strava',
    subtitle:   'Automatically import your activities to kick-start your training cockpit.',
    connectCta: 'Connect my Strava account',
    later:      'Later',
  },

  install: {
```

- [ ] **Step 4: Vérifier la compilation des types**

Run: `cd web && npx tsc --noEmit`
Expected: aucune erreur (en particulier, pas de « property 'onboarding' is missing » sur `en`).

- [ ] **Step 5: Commit**

```bash
git add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts
git commit -m "i18n(onboarding): namespace page connexion Strava"
```

---

### Task 2: Fichier de migration `026`

**Files:**
- Create: `web/supabase/migrations/026_profile_onboarding_skipped.sql`

> Migration déjà appliquée dans Supabase par Franck. On ajoute le fichier au repo pour la cohérence de l'historique — ne PAS prétendre l'appliquer.

- [ ] **Step 1: Créer le fichier**

`web/supabase/migrations/026_profile_onboarding_skipped.sql` :

```sql
-- 026_profile_onboarding_skipped.sql
-- Flag : l'utilisateur a passé l'étape d'onboarding « Connecter Strava ».
-- Empêche la page /onboarding de réapparaître une fois passée définitivement.
alter table profiles
  add column if not exists onboarding_skipped boolean not null default false;
```

- [ ] **Step 2: Commit**

```bash
git add web/supabase/migrations/026_profile_onboarding_skipped.sql
git commit -m "chore(db): migration 026 profiles.onboarding_skipped"
```

---

### Task 3: Autoriser `onboarding_skipped` dans le PATCH profil

**Files:**
- Modify: `web/app/api/profile/route.ts:10-17`

- [ ] **Step 1: Ajouter la clé à la liste `allowed`**

Dans `web/app/api/profile/route.ts`, remplacer la dernière entrée du tableau `allowed` :

```ts
    'hr_zone_method', 'hr_zones_custom', 'hr_method_updated_at',
    'plan_auto_push_title',
```

par :

```ts
    'hr_zone_method', 'hr_zones_custom', 'hr_method_updated_at',
    'plan_auto_push_title', 'onboarding_skipped',
```

- [ ] **Step 2: Commit**

```bash
git add web/app/api/profile/route.ts
git commit -m "feat(profile): autorise onboarding_skipped au PATCH"
```

---

### Task 4: Composant client `OnboardingStrava` (TDD)

**Files:**
- Test: `web/__tests__/onboarding/OnboardingStrava.test.tsx`
- Create: `web/components/onboarding/OnboardingStrava.tsx`

- [ ] **Step 1: Écrire le test qui échoue**

`web/__tests__/onboarding/OnboardingStrava.test.tsx` :

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { OnboardingStrava } from '@/components/onboarding/OnboardingStrava'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

function renderOnboarding() {
  return render(
    <I18nProvider initialLang="fr">
      <OnboardingStrava />
    </I18nProvider>,
  )
}

describe('OnboardingStrava', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as jest.Mock
  })

  it('le CTA pointe vers le endpoint connect avec from=onboarding', () => {
    renderOnboarding()
    const cta = screen.getByRole('link', { name: /connecter mon compte strava/i })
    expect(cta).toHaveAttribute('href', '/api/strava/connect?from=onboarding')
  })

  it('« Plus tard » persiste onboarding_skipped puis route vers le dashboard', async () => {
    renderOnboarding()
    fireEvent.click(screen.getByRole('button', { name: /plus tard/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ onboarding_skipped: true }),
        }),
      )
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd web && npx jest __tests__/onboarding/OnboardingStrava.test.tsx`
Expected: FAIL — `Cannot find module '@/components/onboarding/OnboardingStrava'`.

- [ ] **Step 3: Implémenter le composant**

`web/components/onboarding/OnboardingStrava.tsx` :

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

export function OnboardingStrava() {
  const O = useT().onboarding
  const router = useRouter()
  const [skipping, setSkipping] = useState(false)

  async function handleSkip() {
    setSkipping(true)
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_skipped: true }),
      })
    } catch {
      // on navigue vers le dashboard même si la persistance échoue
    } finally {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-trail-bg flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm space-y-7">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FC4C02]/15 border border-[#FC4C02]/30 flex items-center justify-center">
            <Activity size={28} className="text-[#FC4C02]" />
          </div>
          <h1 className="text-2xl font-bold text-trail-text">{O.title}</h1>
          <p className="text-sm text-trail-muted leading-relaxed">{O.subtitle}</p>
        </div>

        <a
          href="/api/strava/connect?from=onboarding"
          className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-2xl bg-[#FC4C02] hover:bg-[#FC4C02]/90 text-white font-bold uppercase tracking-wider text-sm transition-colors"
        >
          <Activity size={16} />
          {O.connectCta}
        </a>

        <button
          type="button"
          onClick={handleSkip}
          disabled={skipping}
          className="text-sm text-trail-muted underline disabled:opacity-50"
        >
          {skipping ? '…' : O.later}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd web && npx jest __tests__/onboarding/OnboardingStrava.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/onboarding/OnboardingStrava.tsx web/__tests__/onboarding/OnboardingStrava.test.tsx
git commit -m "feat(onboarding): composant OnboardingStrava (CTA + plus tard)"
```

---

### Task 5: Page `/onboarding` (server component)

**Files:**
- Create: `web/app/onboarding/page.tsx`

- [ ] **Step 1: Créer la page**

`web/app/onboarding/page.tsx` :

```tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { OnboardingStrava } from '@/components/onboarding/OnboardingStrava'

export default async function OnboardingPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const [{ data: connection }, { data: profile }] = await Promise.all([
    supabase
      .from('provider_connections')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('provider', 'strava')
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('onboarding_skipped')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (connection || profile?.onboarding_skipped) redirect('/dashboard')

  return <OnboardingStrava />
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd web && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/app/onboarding/page.tsx
git commit -m "feat(onboarding): page /onboarding avec gate connexion/skip"
```

---

### Task 6: `/api/strava/connect` — cookie `strava_from`

**Files:**
- Modify: `web/app/api/strava/connect/route.ts`

- [ ] **Step 1: Lire `?from=onboarding` et poser le cookie**

Remplacer tout le contenu de `web/app/api/strava/connect/route.ts` par :

```ts
import { NextRequest, NextResponse } from 'next/server'
import { buildStravaAuthUrl } from '@/lib/providers/strava/auth'
import { createClient } from '@/lib/database/supabase-server'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/settings', process.env.APP_URL!))
  }

  const from        = request.nextUrl.searchParams.get('from')
  const state       = randomBytes(16).toString('hex')
  const redirectUri = process.env.STRAVA_REDIRECT_URI!
  const authUrl     = buildStravaAuthUrl(redirectUri, state)

  const response = NextResponse.redirect(authUrl)
  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   600,
  }
  response.cookies.set('strava_oauth_state', state, cookieOpts)
  if (from === 'onboarding') {
    response.cookies.set('strava_from', 'onboarding', cookieOpts)
  }
  return response
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd web && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/strava/connect/route.ts
git commit -m "feat(strava): connect mémorise l'origine onboarding (cookie)"
```

---

### Task 7: `/api/strava/callback` — redirection selon l'origine

**Files:**
- Modify: `web/app/api/strava/callback/route.ts`

- [ ] **Step 1: Lire le cookie `strava_from` et router en conséquence**

Dans `web/app/api/strava/callback/route.ts`, après la lecture de `savedState`, ajouter la lecture + suppression du cookie `strava_from` et calculer les URL de destination. Remplacer ce bloc :

```ts
  const cookieStore = await cookies()
  const savedState  = cookieStore.get('strava_oauth_state')?.value

  if (!state || !savedState || state !== savedState) {
    cookieStore.delete('strava_oauth_state')
    return NextResponse.redirect(`${APP_URL}/settings?strava=error`)
  }
  cookieStore.delete('strava_oauth_state')

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/settings?strava=error`)
  }
```

par :

```ts
  const cookieStore = await cookies()
  const savedState  = cookieStore.get('strava_oauth_state')?.value
  const from        = cookieStore.get('strava_from')?.value

  const okUrl  = from === 'onboarding' ? `${APP_URL}/dashboard?strava=connected` : `${APP_URL}/settings?strava=connected`
  const errUrl = from === 'onboarding' ? `${APP_URL}/onboarding?strava=error`    : `${APP_URL}/settings?strava=error`

  cookieStore.delete('strava_from')

  if (!state || !savedState || state !== savedState) {
    cookieStore.delete('strava_oauth_state')
    return NextResponse.redirect(errUrl)
  }
  cookieStore.delete('strava_oauth_state')

  if (error || !code) {
    return NextResponse.redirect(errUrl)
  }
```

- [ ] **Step 2: Utiliser `okUrl` sur le succès, `errUrl` sur l'échec final**

Toujours dans `callback/route.ts`, dans le bloc `try`, remplacer la ligne de succès :

```ts
    return NextResponse.redirect(`${APP_URL}/settings?strava=connected`)
```

par :

```ts
    return NextResponse.redirect(okUrl)
```

et dans le `catch`, remplacer :

```ts
    return NextResponse.redirect(`${APP_URL}/settings?strava=error`)
```

par :

```ts
    return NextResponse.redirect(errUrl)
```

> Le cas `unauthenticated` (`!user`) reste sur `/settings?strava=unauthenticated` — laisser inchangé.

- [ ] **Step 3: Vérifier la compilation**

Run: `cd web && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/strava/callback/route.ts
git commit -m "feat(strava): callback ramène sur /dashboard depuis l'onboarding"
```

---

### Task 8: Gate dans `/dashboard` + vérification finale

**Files:**
- Modify: `web/app/(main)/dashboard/page.tsx:53-74`

- [ ] **Step 1: Ajouter la requête connexion + le flag, et rediriger**

Dans `web/app/(main)/dashboard/page.tsx`, remplacer le bloc `const [ … ] = await Promise.all([ … ])` (et la ligne `const weekActivities` qui suit) par :

```tsx
  const [
    { sportOverviews, weekSessions },
    latestPerSport,
    { data: weekRows },
    { data: athleteProfile },
    { data: stravaConnection },
  ] = await Promise.all([
    getDashboardData(user.id),
    fetchLatestPerSport(supabase, user.id),
    supabase
      .from('activities')
      .select(ACTIVITY_CARD_FIELDS)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gte('start_time', monday.toISOString())
      .lt('start_time', nextMonday.toISOString())
      .order('start_time', { ascending: false }),
    supabase
      .from('profiles')
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, onboarding_skipped')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('provider_connections')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('provider', 'strava')
      .maybeSingle(),
  ])

  if (!stravaConnection && !athleteProfile?.onboarding_skipped) {
    redirect('/onboarding')
  }

  const weekActivities = (weekRows ?? []) as ActivityRow[]
```

> `redirect` est déjà importé en tête du fichier (`import { redirect } from 'next/navigation'`). Le champ `onboarding_skipped` ajouté au select est ignoré par `DashboardGrid` (prop structurelle) — pas d'impact.

- [ ] **Step 2: Vérifier la compilation + le lint + les tests**

Run: `cd web && npx tsc --noEmit && npm run lint && npm test`
Expected: tsc sans erreur, lint OK, suite Jest verte (dont `OnboardingStrava`).

- [ ] **Step 3: Build de production**

Run: `cd web && npm run build`
Expected: build réussi, route `/onboarding` listée dans la sortie.

- [ ] **Step 4: Parcours manuel (dev)**

Run: `cd web && npm run dev`

Vérifier :
1. Créer un compte neuf (ou un compte sans Strava + `onboarding_skipped=false`) → après connexion, arrivée sur `/dashboard` qui redirige vers `/onboarding`.
2. La page `/onboarding` affiche le titre, le pitch, le CTA orange et « Plus tard ».
3. Clic « Plus tard » → retour `/dashboard` (pas de re-redirection) ; recharger `/dashboard` → reste sur le dashboard (flag persistant).
4. Re-mettre `onboarding_skipped=false` en base, recharger → re-redirige vers `/onboarding` ; clic « Connecter mon compte Strava » → OAuth Strava → callback → arrivée sur `/dashboard?strava=connected` (et non `/settings`).
5. Depuis Réglages, le bouton « Connecter » (sans `from`) ramène toujours sur `/settings?strava=connected`.

- [ ] **Step 5: Commit**

```bash
git add "web/app/(main)/dashboard/page.tsx"
git commit -m "feat(onboarding): gate /dashboard -> /onboarding si Strava non lié"
```

---

## Self-Review

- **Spec coverage :** déclenchement par état non-connecté (Task 8 gate + Task 5 page) ✓ ; skip persistant (Task 1 i18n, Task 2 colonne, Task 3 PATCH, Task 4 bouton) ✓ ; retour dashboard après connexion (Task 6 + 7) ✓ ; i18n (Task 1) ✓ ; migration au repo (Task 2) ✓.
- **Cohérence des noms :** `onboarding_skipped` (colonne + PATCH allowed + select dashboard + page), `strava_from` cookie posé en Task 6 et lu en Task 7, `from=onboarding` query posé par le CTA (Task 4) et lu en Task 6 — alignés.
- **Pas de placeholder :** code complet à chaque étape.
- **Tests :** TDD sur le seul composant unit-testable selon les conventions du repo (client) ; glue serveur couverte par build + parcours manuel documenté (Task 8).
