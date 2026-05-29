# Trail Cockpit Web

Web app mobile-first pour le suivi d'entraînement trail / endurance.

## Stack

- Next.js 14 (App Router)
- TypeScript 5
- Tailwind CSS 3
- Supabase (auth + DB)
- Recharts (graphiques)

## Installation

```bash
cd web
npm install
```

## Lancer en local

1. Copier les variables d'env :

```bash
cp .env.example .env.local
```

2. Remplir `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=abc...
STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback
STRAVA_WEBHOOK_VERIFY_TOKEN=trail_cockpit_webhook_secret
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_API_KEY=sk-...
```

3. Démarrer :

```bash
npm run dev
```

App disponible sur : http://localhost:3000

## Build

```bash
npm run build
npm start
```

## Tests

```bash
npm test
```

## Tester sur mobile avec ngrok

```bash
ngrok http 3000
```

Puis mettre à jour `.env.local` :

```env
APP_URL=https://xxx.ngrok-free.app
NEXT_PUBLIC_APP_URL=https://xxx.ngrok-free.app
STRAVA_REDIRECT_URI=https://xxx.ngrok-free.app/api/strava/callback
```

## Configuration Supabase

### 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → **New project**
2. Choisir un nom de projet (ex: `trail-cockpit`)
3. Choisir un mot de passe pour la base de données (le noter)
4. Sélectionner une région proche (ex: `West EU`)
5. Attendre ~2 minutes que le projet soit prêt

### 2. Récupérer les clés

Dans le dashboard Supabase → **Settings → API** :

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Section **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Section **Project API keys → anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | Section **Project API keys → service_role** (⚠️ secret) |

Copier ces trois valeurs dans `.env.local`.

### 3. Appliquer les migrations

**Option A — Supabase CLI (recommandé)**

```bash
npm install -g supabase
supabase login
supabase link --project-ref <votre-project-ref>
# Le project-ref est dans Settings → General → Reference ID
supabase db push
```

**Option B — SQL Editor dans le dashboard**

Dans Supabase → **SQL Editor**, exécuter dans l'ordre :

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_profile_trigger.sql`

### 4. Vérifier les tables créées

Dans Supabase → **Table Editor**, vous devez voir :
`profiles`, `provider_connections`, `activities`, `activity_metrics`,
`daily_metrics`, `weekly_metrics`, `webhook_events`, `sync_jobs`,
`coach_messages`, `admin_logs`

### 5. Tester signup / login

```bash
cd web && npm run dev
```

1. Ouvrir http://localhost:3000/signup
2. Saisir un email et un mot de passe (min 6 caractères)
3. Cliquer **Créer mon compte**
   - Si email confirmation désactivée → redirection vers `/dashboard`
   - Si email confirmation activée → message "Vérifiez votre email"
4. Aller dans Supabase → **Authentication → Users** : votre utilisateur apparaît
5. Aller dans Supabase → **Table Editor → profiles** : une ligne a été créée automatiquement
6. Ouvrir http://localhost:3000/settings : votre email apparaît dans la section **Compte**
7. Cliquer **Se déconnecter** → retour à la page d'accueil

### Désactiver la confirmation email (optionnel en développement)

Dans Supabase → **Authentication → Providers → Email** :
désactiver **Confirm email** pour un accès immédiat sans vérifier l'email.
