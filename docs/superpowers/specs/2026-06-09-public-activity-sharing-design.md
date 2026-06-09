# Partage public des activités — Design

> **Status: Spec** · 2026-06-09

## Objectif

Permettre à n'importe qui d'ouvrir le lien d'une activité
(`https://trailcockpit.run/activities/<uuid>`) **sans compte Trailcockpit**, en
lecture seule. L'URL canonique de l'activité reste celle partagée — pas de lien
`/share/...` séparé.

## Décisions produit

- **Modèle de confidentialité : lien public toujours actif (« non répertorié »).**
  Toute activité est accessible à qui possède l'URL. L'UUID v4 est indevinable
  → sécurité par obscurité assumée, comme les liens « unlisted ». Pas de toggle
  par activité, pas de colonne `is_public`, pas de migration.
- **Contenu : page complète en lecture seule.** Le visiteur voit les mêmes blocs
  qu'aujourd'hui (allure, FC, courbe FC, CES, splits/laps, carte) sans les
  contrôles d'édition, avec un CTA d'inscription.

## État actuel (contraintes)

- La page détail est sous `app/(main)/activities/[id]/page.tsx`.
- Le layout `app/(main)/layout.tsx` fait `redirect('/login')` si pas d'utilisateur
  (ligne 11), **et** la page elle-même fait `redirect('/login')` (ligne 17).
- Les données sont lues avec le client SSR + filtre `.eq('user_id', user.id)` et la
  RLS `activities_select_own` (`auth.uid() = user_id`) → un visiteur anonyme ne peut
  rien lire.
- La page lit aussi le **profil FC du propriétaire** (zones), la **courbe FC**, et
  rafraîchit splits/laps via le **token Strava de l'utilisateur connecté**.
- `createServiceClient()` (service-role, bypass RLS) existe dans
  `web/lib/database/supabase-server.ts:35`.
- `PreferencesProvider` no-op proprement sans user (retourne tôt si `!user`) →
  safe pour un visiteur anonyme.

## Approche retenue : route publique unique (service-role)

La **même URL `/activities/[id]`** sert le propriétaire (édition + nav shell) et le
visiteur anonyme (lecture seule). Lecture des données via service-role côté serveur.

Alternatives écartées :
- **Page de partage séparée `/share/...`** : contredit le choix « l'URL canonique
  doit être publique ».
- **Policy RLS publique** sur `activities` : obligerait aussi à ouvrir
  `activity_streams` et une partie de `profiles` (zones FC) en lecture anonyme →
  policies trop larges. Le service-role ciblé sur cette seule route est plus contenu.

## Spécification

### 1. Routing

Déplacer `app/(main)/activities/[id]/` → nouveau groupe `app/(public)/activities/[id]/`
(page + client). La liste `/activities` reste dans `(main)`.

- `/activities` (liste, gated, shell) et `/activities/[id]` (détail, public) résolvent
  vers des chemins distincts → pas de conflit Next.js. **À valider au build.**
- `app/(public)/layout.tsx` branche selon la session :
  - **connecté** → `PreferencesProvider` + `AppShell` (parité avec l'expérience
    actuelle du propriétaire) ;
  - **anonyme** → en-tête minimal (logo + CTA « Découvrir Trailcockpit ») ;
    `PreferencesProvider` reste monté (no-op sans user).

### 2. Data layer — `getPublicActivity(id)`

Server-only, via `createServiceClient()` (bypass RLS) :

- activité par `id` seul, `deleted_at is null` → sinon `notFound()` ;
- profil FC **du propriétaire** (`profiles` filtré par `activity.user_id`) pour le
  calcul des zones — uniquement les champs nécessaires
  (`max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year,
  hr_zone_method, hr_zones_custom`) ;
- courbe FC (`activity_streams` par `activity_id`, dézippée via `unpackStreams`) ;
- splits/laps **uniquement depuis `raw_payload`** (pas d'appel Strava).

### 3. Page (server component)

- `user = getUser()` (nullable) ;
- `activity = getPublicActivity(id)` ;
- `isOwner = !!user && user.id === activity.user_id` ;
- rend `<ActivityDetailClient … readOnly={!isOwner} />`.
- **Branche propriétaire** (`isOwner`) : comportement actuel inchangé — édition,
  refresh splits/laps via token Strava, persistance des patchs (`calories`,
  `raw_payload`). Ce chemin reste strictement réservé au propriétaire.
- **Branche visiteur** (`!isOwner`, connecté ou non) : lecture seule, aucun appel
  Strava, aucune écriture DB.

### 4. Lecture seule — `ActivityDetailClient`

Nouveau prop `readOnly?: boolean` (défaut `false`). Quand `true` :

- masquer le bouton Modifier (ligne 359) ; `EditActivityModal` jamais monté ;
- popups effort / intensité / type rendus non-cliquables (info seule, pas de
  `setPopup` déclencheur d'écriture) ;
- `router.back()` (ligne 342) → lien vers l'accueil / l'inscription ;
- CTA discret « Créé sur Trailcockpit — créer un compte ».

### 5. Sécurité & SEO

- Lecture service-role par UUID = modèle « non répertorié » assumé. N'exposer que
  les champs activité + config FC nécessaires aux zones — **aucune** donnée
  d'identité ni email.
- `metadata.robots = { index: false, follow: false }` (non répertorié → pas
  d'indexation moteurs).
- OpenGraph `title` = nom de l'activité pour un aperçu de lien correct (nice-to-have).
- Ne jamais appeler l'API Strava pour le compte d'un visiteur non-propriétaire.

### 6. Tests

- `getPublicActivity` : retourne l'activité par id quel que soit le propriétaire ;
  `null` si `deleted_at` non nul ou id absent.
- Composant `ActivityDetailClient` avec `readOnly` : bouton Modifier absent, popups
  d'écriture désactivés, `EditActivityModal` non monté.
- Lancer **seulement** les suites concernées (failures i18n pré-existantes connues —
  `useI18n` hors `I18nProvider`).

## Hors périmètre

- Toggle de partage par activité / colonne `is_public` (non retenu).
- Partage social automatique, vignettes d'aperçu personnalisées au-delà de l'OG title.
- Modification du modèle RLS.
