# Architecture Trail Cockpit (web app)

> Doc vivante · dernière mise à jour: 2026-05-14
> Pour les détails du modèle CES, voir [BLUEPRINT_CES.md](./BLUEPRINT_CES.md)
> Pour la math intensité/charge, voir [MODELE_MATHEMATIQUE.md](./MODELE_MATHEMATIQUE.md)

## Vue d'ensemble

Trail Cockpit est une **PWA Next.js** déployée sur Vercel ([trail-cockpit.vercel.app](https://trail-cockpit.vercel.app)), connectée à Supabase pour la persistance et à Strava pour l'ingestion d'activités. L'ancien client Android Kotlin/Jetpack Compose est legacy (voir section dédiée en bas).

### Stack

| Couche | Techno |
|---|---|
| Framework | Next.js 14 (App Router, RSC + Route Handlers) |
| Langage | TypeScript |
| UI | Tailwind CSS, composants maison + Recharts pour les graphes |
| Auth + DB | Supabase (Postgres + Row Level Security), client SSR via `@supabase/ssr` |
| Fournisseur d'activités | Strava (OAuth 2.0 + Webhooks + REST v3) |
| Hosting | Vercel (Functions + Cron Jobs + Edge Middleware) |
| Tests | Jest |
| Runtime Node | 20.x (pinné dans `engines` + `.nvmrc`) |

## Arborescence `web/`

```
web/
  app/
    (main)/                 → shell authentifié : dashboard, charge, activities,
                              plan, courses, coach, profile, settings, admin
    api/
      strava/               → connect, callback, sync, disconnect,
                              webhook, import-status
      webhooks/strava/      → réception des events Strava
      cron/strava-import/   → import bulk planifié (Vercel Cron)
      activities/           → CRUD + list-for-deduce
      profile/, admin/
    auth/, login/, signup/, legal/, support/, layout.tsx
  components/               → activity, blocks, charge, charts, cockpit,
                              navigation, providers, settings, support, ui,
                              auth, legal
  lib/
    analytics/              → CES, EWMA fatigue/forme, insights charge,
                              ultra-ready (cœur métier, porté depuis Kotlin)
    activities/             → detail, indicators, intensity, vap
                              (Velocity-Adjusted Pace)
    data/                   → charge.ts, dashboard.ts (data fetchers serveur)
    database/               → supabase-client.ts, supabase-server.ts,
                              get-user, get-admin
    providers/strava/       → auth, api, token, mapper, syncer, webhook, import
    sync/                   → import-activities, recalculate-scores
    admin/, health/, design/
  middleware.ts             → refresh session Supabase + garde /admin
  public/                   → manifest.json, sw.js, icons
  supabase/migrations/      → SQL numérotés 001 → 012 (non auto-appliqués)
  __tests__/                → tests Jest miroir de lib/, components/, app/
  scripts/build.js          → wrapper next build avec retry ENOTEMPTY (Windows)
  vercel.json               → framework, buildCommand, outputDirectory
```

## Flux de données global

```
Strava (REST + Webhooks)
    │
    ├─ webhook receiver  ── (events: create/update/delete)
    │   web/app/api/webhooks/strava/route.ts
    │
    ├─ cron import bulk  ── (paginé, 5 users/tick, cascade waitUntil)
    │   web/app/api/cron/strava-import/route.ts
    │
    └─ sync à la demande
        web/app/api/strava/sync/route.ts
                    │
                    ▼
        lib/providers/strava/{api,mapper,token,import,syncer}.ts
                    │
                    ▼  NormalizedActivity[]
        lib/sync/import-activities.ts  (calcule CES + upsert)
                    │
                    ▼
              Supabase (table activities + provider_connections)
                    │
                    ▼
        lib/data/{charge,dashboard}.ts  (fetchers serveur)
                    │
                    ▼
        lib/analytics/{load,fatigue,charge-insights,ultra-ready}
                    │
                    ▼
          UI : app/(main)/{dashboard,charge,activities,...}
```

## Flux critiques

### 1. Auth Supabase + Middleware

- `web/middleware.ts` s'exécute sur **toutes les requêtes** (sauf `_next/static`, images, icônes, manifest).
- Appelle `supabase.auth.getUser()` pour rafraîchir le cookie de session.
- **Invariant** : tolère que Supabase soit injoignable — un `try/catch` capture l'erreur, `user` reste `null`, et la requête continue sans session.
- `/admin` est ouvert en dev, redirige vers `/login` en prod sans session.
- Clients :
  - `web/lib/database/supabase-server.ts` — RSC + Route Handlers (`createServerClient`) et `createServiceClient` (bypass RLS, jamais exposé côté client).
  - `web/lib/database/supabase-client.ts` — composants client.

### 2. Strava OAuth + Import

OAuth (3 étapes) :

1. `GET /api/strava/connect` — redirige vers le consent screen Strava.
2. `GET /api/strava/callback` — échange `code` contre `access_token` + `refresh_token`, stocke dans `provider_connections`.
3. `lib/providers/strava/token.ts` — `getValidStravaToken()` rafraîchit si `expires_at < now`.

Import initial : bulk paginé via le cron Vercel.

| Élément | Fichier | Rôle |
|---|---|---|
| Cron handler | `web/app/api/cron/strava-import/route.ts` | Auth `Bearer CRON_SECRET`, picks 5 users en `pending`/`in_progress`, garde anti-chevauchement 50s, cascade `waitUntil` jusqu'à `depth=50` |
| Tick | `web/lib/providers/strava/import.ts` | `processOneImportTick` — 5 pages × 200 activités/tick, curseur `import_oldest_at` |
| Mapping | `web/lib/providers/strava/mapper.ts` | `StravaActivity → NormalizedActivity` |
| Persistance | `web/lib/sync/import-activities.ts` | Calcule CES via `computeCesResult` puis upsert |
| Webhook live | `web/app/api/webhooks/strava/route.ts` + `lib/providers/strava/webhook.ts` | Receives create/update/delete, déclenche un sync ciblé |

### 3. Calcul CES (Cockpit Effort Score)

Pipeline dans `web/lib/analytics/` :

```
ActivityInput
    │
    ▼ effort-score.ts        → CES par activité (multi-sport, remplace suffer score Strava)
    │
    ▼ load.ts                → aggregateToDailyLoad : Activity[] → DailyLoad[]
    │
    ▼ fatigue.ts             → buildDailyMetrics : EWMA k=7 (ATL), k=42 (CTL), TSB = CTL - ATL
    │
    ▼ charge-thresholds.ts   → seuils dérivés
    ▼ charge-insights.ts     → statuts/messages charge
    ▼ ultra-ready.ts         → indicateur "prêt pour l'ultra"
```

**Invariant critique** (`fatigue.ts::fillConsecutiveDays`) : l'agrégation journalière doit émettre **tous les jours** de la fenêtre, y compris ceux à `ces = 0`. Sauter les jours sans activité corrompt les courbes EWMA (l'amortissement n'a plus de pas constant). Le port Android original (`TrainingLoadCalculator.kt :: aggregateActivitiesByDay`) avait la même règle — la conserver sur tout port.

Recalcul : `web/lib/sync/recalculate-scores.ts` (utilisé quand le profil change : poids, FC max, seuil, etc.).

### 4. PWA

- Manifest : `web/public/manifest.json`
  - `start_url: /dashboard`, `display: standalone`, `orientation: portrait`
  - Icons 192/512 (`any maskable`), theme `#FF6B35`, background `#0A0F0E`
- Service Worker : `web/public/sw.js`
  - Versionné (`VERSION = 'v2'`) avec deux caches : `STATIC_CACHE`, `RUNTIME_CACHE`
  - Précache : `/`, `/manifest.json`, icônes
  - Stratégies : network-first pour `/api/`, cache-first pour assets statiques (`_next/static`, `/icons/`, images/fonts)
  - `skipWaiting` + `clients.claim` pour activation immédiate
- Le matcher du middleware **exclut** explicitement `manifest.json`, `favicon.ico`, `icons/` pour ne pas casser l'install PWA.

## Données — Supabase

Migrations dans `web/supabase/migrations/` (numérotées) :

| # | Sujet |
|---|---|
| 001 | Schéma initial (users, activities, provider_connections, profiles) |
| 002 | Row Level Security |
| 003 | Trigger profile auto-créé |
| 004-005 | Champs cardio + threshold pace |
| 006 | Versioning effort score |
| 007 | Remap intensité manuelle obsolète |
| 008 | Webhook logs + soft delete |
| 009 | État import initial Strava |
| 010 | Méthode zones FC |
| 011-012 | Workout type (manuel + backfill swim/fractionne) |

**Rappel** : ces SQL ne sont **pas auto-appliqués**. Toujours coller le contenu dans le SQL Editor Supabase (ou `supabase db push` si CLI linkée).

## Déploiement

- Push sur la branche connectée → Vercel auto-deploy. **Ne jamais** lancer `vercel --prod` en CLI.
- `web/vercel.json` : `framework: nextjs`, `buildCommand: npm run build`, `outputDirectory: .next`.
- Build local : `npm run build` → `scripts/build.js` (retry sur `ENOTEMPTY` Windows).
- Variables d'env (dashboard Vercel) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN`, `APP_URL`, `CRON_SECRET`. Liste complète dans `web/README.md`.

## Points critiques pour la maintenance

1. **Middleware** : ne jamais retirer le `try/catch` autour de `getUser()` — la PWA doit fonctionner offline/dégradé.
2. **Cron Strava** : respecter `MAX_USERS_PER_TICK=5`, `PAGES_PER_TICK=5`, garde anti-chevauchement 50s. Le timeout Vercel Hobby est ~10s ; chaque tick vise 6-8s.
3. **CES days-zero** : ne pas optimiser `aggregateToDailyLoad` en sautant les jours vides — l'EWMA dépend du pas régulier.
4. **`createServiceClient`** : usage strictement serveur (cron, webhooks, route handlers admin). Jamais importé depuis un composant client.
5. **Migrations SQL** : signaler à Franck qu'il doit les appliquer manuellement après commit du fichier.

## Tests

- `npm test` (Jest, `--passWithNoTests`)
- Test ciblé : `npx jest path/to/file.test.ts` ou `npx jest -t "name pattern"`
- Tests miroirs dans `web/__tests__/` (mêmes chemins que `lib/`, `components/`, `app/`)

## Legacy — Android (archivé)

Le client Android Kotlin/Jetpack Compose n'est plus le focus. Il reste dans `app/`, `gradle/`, `build.gradle.kts`, et son backend OAuth dans `backend/strava-oauth/`. Le `package.json` Expo/React Native à la racine est un reliquat à ignorer.

Anciens documents : [`docs/archive/`](../archive/)
- `BLUEPRINT_v1.md` — blueprint initial Android
- `i18n-android-2026-04-28-{spec,plan}.md` — i18n côté Android
- `strava-draft-plan.md` — premier plan Strava
- `trail-cockpit-mise-en-ligne.md` — checklist mise en ligne Play Store

La logique métier (CES, EWMA fatigue, zones FC, VAP) a été portée depuis `TrainingLoadCalculator.kt` et `CesCalculator.kt` vers `web/lib/analytics/`. Les invariants doivent rester alignés entre les deux implémentations tant que l'app Kotlin existe en archive.
