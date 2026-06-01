# Onboarding — page « Connecter Strava » après inscription

> **Status: Implémenté** · 2026-06-01 · Code: `web/app/onboarding/page.tsx`, `web/components/onboarding/OnboardingStrava.tsx`, gate `web/app/(main)/dashboard/page.tsx`, OAuth `web/app/api/strava/{connect,callback}/route.ts` (helper `stravaCallbackRedirects` dans `lib/providers/strava/auth.ts`), migrations `026`+`027`.

## Drift notes

- Backfill `027` ajouté (hors spec initiale) : les comptes existants sont marqués `onboarding_skipped=true` pour que le gate ne cible que les comptes créés après la mise en ligne (décision Franck 2026-06-01).
- Tests livrés : `OnboardingStrava` (composant) + `stravaCallbackRedirects` (logique de redirection extraite dans un helper pur). Les redirections des server components (`onboarding/page`, gate dashboard) restent vérifiées manuellement — pas de harness de test RSC dans le repo.

## Objectif

Après la création d'un compte, proposer à l'utilisateur une page dédiée pour
connecter son compte Strava, afin qu'il n'ait pas à aller chercher l'option
dans Réglages. Faciliter la toute première connexion.

## Comportement attendu

- Tant que l'utilisateur n'a **pas** connecté Strava **et** n'a **pas** passé
  l'étape, il est redirigé vers `/onboarding` à son arrivée dans l'app.
- L'utilisateur peut **passer définitivement** (« Plus tard ») : un flag
  persistant `profiles.onboarding_skipped` empêche la page de réapparaître. Il
  pourra toujours connecter Strava via Réglages.
- Une fois Strava connecté depuis cette page, l'utilisateur atterrit sur
  `/dashboard` (où l'indicateur d'import des activités est déjà affiché).

## Décisions de design

- **Déclenchement** : gate basé sur l'état « Strava non connecté » (pas
  uniquement « juste après signup »), pour couvrir aussi le cas confirmation
  email où l'utilisateur revient plus tard.
- **« Passer » persistant** : colonne booléenne sur `profiles` (le gate de
  redirection est côté serveur → localStorage exclu, le serveur ne pourrait pas
  le lire pour décider la redirection).
- **Placement du gate** : dans la page `/dashboard` uniquement. Tous les chemins
  d'entrée d'un nouvel utilisateur convergent vers `/dashboard`
  (login → `/dashboard`, signup → `/dashboard`, confirmation email → `/` →
  `/dashboard`). Plus léger qu'un gate dans `(main)/layout.tsx` (qui ajouterait
  2 requêtes à chaque navigation pour les utilisateurs déjà connectés).

## Architecture

### 1. Migration `026_profile_onboarding_skipped.sql`

```sql
alter table profiles
  add column if not exists onboarding_skipped boolean not null default false;
```

> Déjà appliquée dans Supabase par Franck. Le fichier doit être ajouté au repo
> pour garder l'historique des migrations en cohérence.

### 2. Route `/onboarding` (top-level, hors groupe `(main)`)

Plein écran, sans bottom-nav, style cohérent avec `LoginForm`.

`app/onboarding/page.tsx` — server component :

- `redirect('/login')` si pas d'utilisateur.
- `redirect('/dashboard')` si Strava déjà connecté **ou** si
  `onboarding_skipped === true` (empêche l'accès direct et toute boucle).
- Sinon, rend le client component `OnboardingStrava`.

### 3. `components/onboarding/OnboardingStrava.tsx` (client)

- Hero : logo, titre, pitch (« connecte Strava pour importer tes activités »).
- CTA orange « Connecter mon compte Strava » → lien
  `/api/strava/connect?from=onboarding`.
- Bouton discret « Plus tard » → `PATCH /api/profile { onboarding_skipped: true }`
  puis `router.push('/dashboard')`.

### 4. Action « Plus tard »

- `app/api/profile/route.ts` : ajouter `'onboarding_skipped'` à la liste
  `allowed` du PATCH.

### 5. Retour dashboard après connexion Strava

- `app/api/strava/connect/route.ts` : lire `?from=onboarding` ; si présent,
  poser un cookie court `strava_from=onboarding` (httpOnly, sameSite lax,
  maxAge ~600s) à côté du cookie `strava_oauth_state`.
- `app/api/strava/callback/route.ts` : lire ce cookie ; si `onboarding` →
  `redirect('/dashboard?strava=connected')`, sinon comportement actuel
  (`/settings?strava=connected`). Supprimer le cookie après lecture (dans tous
  les chemins de sortie du callback).

### 6. Gate dans `app/(main)/dashboard/page.tsx`

- Ajouter `onboarding_skipped` au `select` `profiles` existant.
- Ajouter dans le `Promise.all` une requête d'existence `provider_connections`
  (provider `strava`, `user_id`) — `select('user_id').limit(1).maybeSingle()`.
- Après résolution : si `!connected && !onboarding_skipped` →
  `redirect('/onboarding')`.

### 7. i18n

- Nouveau namespace `onboarding` (titre, pitch, label CTA, label « Plus tard »)
  dans `lib/i18n/dictionaries/fr.ts` + `en.ts` + l'interface typée.

## Fichiers touchés

| Fichier | Type |
| --- | --- |
| `web/supabase/migrations/026_profile_onboarding_skipped.sql` | nouveau |
| `web/app/onboarding/page.tsx` | nouveau |
| `web/components/onboarding/OnboardingStrava.tsx` | nouveau |
| `web/app/api/profile/route.ts` | modif (allowed) |
| `web/app/api/strava/connect/route.ts` | modif (cookie from) |
| `web/app/api/strava/callback/route.ts` | modif (redirect selon cookie) |
| `web/app/(main)/dashboard/page.tsx` | modif (gate) |
| `web/lib/i18n/dictionaries/fr.ts` | modif (namespace onboarding) |
| `web/lib/i18n/dictionaries/en.ts` | modif (namespace onboarding) |

## Tests

- `onboarding/page` : redirige vers `/login` sans user ; vers `/dashboard` si
  connecté ou skipped ; rend la page sinon.
- Gate dashboard : redirige vers `/onboarding` quand non connecté & non skipped ;
  ne redirige pas sinon.
- Callback Strava : redirige vers `/dashboard` quand cookie `from=onboarding`,
  vers `/settings` sinon.

## Hors scope (YAGNI)

- Pas de progression d'import affichée sur la page d'onboarding (le dashboard
  l'affiche déjà).
- Pas de gate dans `(main)/layout.tsx`.
- Pas d'autres providers que Strava.
