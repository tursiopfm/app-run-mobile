# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Where to work

The active codebase is the **Next.js web app in `web/`** (PWA, deployed to https://trail-cockpit.vercel.app). Default to working there unless Franck explicitly asks for Android.

Legacy / not the active focus:
- `app/`, `gradle/`, `build.gradle.kts`, `settings.gradle.kts` — original Android (Kotlin + Jetpack Compose) app being migrated away from.
- `backend/strava-oauth/` — Node.js OAuth proxy that served the Android app.
- The Expo/React Native `package.json` at the repo root is leftover scaffolding; ignore it.

## Web app — common commands

Run from `web/` (Node 20.x, pinned via `engines` and `.nvmrc`):

```bash
npm run dev          # next dev (localhost:3000)
npm run dev:lan      # next dev --hostname 0.0.0.0 (for phone testing on LAN)
npm run build        # scripts/build.js — Next build with Windows ENOTEMPTY retry
npm run start        # next start (after build)
npm run lint         # next lint
npm test             # jest --passWithNoTests
npm run test:watch
```

Single test: `npx jest path/to/file.test.ts` or `npx jest -t "name pattern"`.

The custom `scripts/build.js` wrapper exists because Next 14 + Node 20 on Windows occasionally throws `ENOTEMPTY` removing `.next/export`; the wrapper retries once after cleanup. Don't replace it with a plain `next build`.

## Deployment

- **Deploy by pushing to GitHub** — Vercel auto-deploys on push to the connected branch. Do **not** run `vercel --prod` from the CLI.
- `web/vercel.json` pins `framework: nextjs`, `buildCommand: npm run build`, `outputDirectory: .next`.
- Env vars live in the Vercel dashboard (Supabase URL/keys, Strava client id/secret, `APP_URL`, etc.). `web/README.md` lists the full set.

## Supabase migrations

Migration SQL files in `web/supabase/migrations/` are **not auto-applied**. When adding one, remind Franck to paste it into the Supabase SQL Editor (or run `supabase db push` if he has the CLI linked). Don't claim a schema change is live just because the file exists.

## Service Worker (PWA cache)

Le SW est généré au build, ne **jamais** éditer `web/public/sw.js` directement — c'est un artefact gitignoré.

- Source de vérité : `web/scripts/sw.template.js`
- Script d'injection : `web/scripts/generate-sw.js` (lit le template, remplace `__SW_VERSION__` par le SHA court du commit, écrit `public/sw.js`)
- Hook de build : appelé automatiquement par `web/scripts/build.js` avant `next build`
- VERSION source, par priorité : `VERCEL_GIT_COMMIT_SHA` → `git rev-parse HEAD` → `Date.now()`

À chaque déploiement, `VERSION` change donc l'event `activate` du SW supprime les anciens caches `trail-static-*` / `trail-runtime-*` et `clients.claim()` force la nouvelle version active sur les onglets ouverts. Sans ça : les chunks JS cachés restent obsolètes après deploy → router Next.js gelé silencieusement (incident 2026-05-14).

**Si tu modifies la logique du SW** (handlers `fetch`/`install`/`activate`), édite uniquement `scripts/sw.template.js` ; le bump de VERSION est automatique au push suivant.

## Web architecture

Next.js 14 App Router, TypeScript, Tailwind, Supabase SSR (`@supabase/ssr`), Recharts.

```
web/
  app/
    (main)/              → authenticated app shell: dashboard, charge, activities, plan,
                           courses, coach, profile, settings, admin
    api/                  → route handlers
      strava/             → OAuth: connect, callback, sync, disconnect, webhook, import-status
      webhooks/strava/    → Strava webhook receiver
      cron/strava-import/ → scheduled bulk import
      activities/         → CRUD + list-for-deduce
      profile/, admin/
    auth/, login/, signup/, legal/, support/, layout.tsx
  components/             → cockpit (blocs Cockpit), charge (blocs Charge),
                            activity, charts, navigation, providers, settings,
                            support, ui, auth, legal, blocks (BlockGrid générique)
  lib/
    analytics/            → effort-score, fatigue (EWMA ATL/CTL/TSB), load, charge-insights,
                            charge-thresholds, ultra-ready  ← ports from the Android Kotlin
    activities/           → detail, indicators, intensity, vap (Velocity-Adjusted Pace)
    data/                 → charge.ts, dashboard.ts (server-side data fetchers)
    database/             → supabase-client.ts, supabase-server.ts, get-user/get-admin
    sync/                 → import-activities, recalculate-scores
    providers/, admin/, health/, design/
  middleware.ts           → Supabase session refresh on every request; gates /admin in prod
  supabase/migrations/    → numbered .sql files (001…011 currently)
  __tests__/              → Jest tests mirroring lib/, components/, app/ structure
```

Middleware (`web/middleware.ts`) calls `supabase.auth.getUser()` on every request to refresh the session cookie. It tolerates Supabase being unreachable. `/admin` is open in dev, requires auth in prod.

## Documentation

Indexée dans `docs/README.md`. Trois zones :
- `docs/reference/` — docs **vivantes** à lire en début de session (ARCHITECTURE, BLUEPRINT_CES, MODELE_MATHEMATIQUE, MAINTENANCE).
- `docs/superpowers/specs|plans/` — designs et plans d'implémentation (avec bandeau `Status: Implémenté` quand la feature est livrée).
- `docs/archive/` — docs historiques ou supersedées, ne pas s'y référer pour l'état actuel.

## Domain model — CES (Cockpit Effort Score)

The training-load math is the heart of this project. Full spec: `docs/reference/BLUEPRINT_CES.md`. Reference doc on effort/HR/intensity: `docs/reference/MODELE_MATHEMATIQUE.md` (source of truth).

Implementation lives in `web/lib/analytics/`:
- `effort-score.ts` — per-activity CES (multi-sport; replaces Strava's suffer score)
- `load.ts` — aggregates activities → 30-day `DailyLoad` series
- `fatigue.ts` — EWMA k=7 (ATL/fatigue) vs k=42 (CTL/fitness), TSB (freshness)
- `charge-thresholds.ts`, `charge-insights.ts`, `ultra-ready.ts` — derived statuses

**Critical invariant:** the daily aggregation must emit **every** day in the window, including days with no activity (`ces = 0`). Skipping zero-days corrupts the EWMA curves. The Android equivalent (`TrainingLoadCalculator.kt` / `aggregateActivitiesByDay()`) has the same rule — preserve it on any port.

## Working style (Franck's preferences)

- French-language responses; code direct, minimal explanation.
- Make small, targeted edits. Ask before touching multiple files.
- Only read files explicitly relevant to the task — don't pre-scan the codebase.
- When executing a written plan, use the Subagent-driven execution mode, not inline.

## Self-learning loop

- Read `tasks/lessons.md` at the start of each session before touching code; apply each rule listed.
- After any correction from Franck, append an entry to `tasks/lessons.md` in the format:
  `[YYYY-MM-DD] | what went wrong | rule to follow next time`

## Documentation upkeep

- Quand on implémente une feature liée à une spec dans `docs/superpowers/specs/`, ajouter le bandeau `> **Status: Implémenté** · YYYY-MM-DD · Code: <chemin>` en tête de la spec. Si le code diverge significativement, ajouter une section `## Drift notes` en fin de fichier.
- Quand on touche au modèle CES / charge / intensité / auth, mettre à jour le doc concerné dans `docs/reference/` dans la même PR.
- Quand on découvre du travail différé (idée, bug, refacto), l'ajouter à `tasks/backlog.md` au format défini en bas du fichier.
