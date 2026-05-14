# Trail Cockpit — Checklist de mise en ligne Web App

> Objectif : passer d’un projet local à une **web app en ligne**, avec un backend évolutif pour une future publication **Play Store** et **App Store**.

---

## 0. Vision générale

On ne construit pas seulement un site web.  
On construit une plateforme complète :

```txt
Utilisateur
   ↓
Web app mobile / PWA
   ↓
Backend API unique
   ↓
Base de données Supabase
   ↓
Connecteurs sport : Strava, puis Garmin / Polar / Suunto
   ↓
Moteur d’analyse + Coach IA
```

Le point important :

```txt
Le backend doit rester le même pour :
- la web app
- la future app Android
- la future app iPhone
```

Donc on évite de mettre la logique importante directement dans Android Studio.

---

## 1. Choix technique recommandé

### Frontend

```txt
Next.js / React
```

Rôle :

```txt
- Pages de l’application
- Dashboard
- Pages utilisateur
- Page admin
- Interface mobile-first
- PWA plus tard
```

### Backend

```txt
API routes Next.js
+ Supabase Edge Functions si besoin
```

Rôle :

```txt
- Connexion Strava
- Webhooks
- Sécurité
- Appels IA
- Synchronisation des activités
- Calculs sportifs
```

### Base de données

```txt
Supabase PostgreSQL
```

Rôle :

```txt
- Utilisateurs
- Profils sportifs
- Connexions Strava / Garmin / Polar / Suunto
- Activités
- Scores d’effort
- Plans d’entraînement
- Logs admin
```

### Hébergement

```txt
Vercel
```

Rôle :

```txt
- Mise en ligne automatique depuis GitHub
- Hébergement de la web app
- Fonctions backend simples
- Cron jobs simples
```

### Code

```txt
GitHub
```

Rôle :

```txt
- Stocker le code
- Suivre l’historique
- Déploiement automatique vers Vercel
- Travail avec Codex / Claude Code
```

---

## 2. Architecture cible

```txt
trail-cockpit/
│
├── app/
│   ├── dashboard/
│   ├── activities/
│   ├── coach/
│   ├── training-plan/
│   ├── settings/
│   └── admin/
│
├── app/api/
│   ├── strava/
│   │   ├── connect/
│   │   └── callback/
│   │
│   ├── webhooks/
│   │   └── strava/
│   │
│   ├── sync/
│   ├── coach/
│   └── admin/
│
├── lib/
│   ├── providers/
│   │   ├── strava/
│   │   │   ├── auth.ts
│   │   │   ├── sync.ts
│   │   │   ├── webhook.ts
│   │   │   └── mapper.ts
│   │   │
│   │   ├── garmin/
│   │   ├── polar/
│   │   └── suunto/
│   │
│   ├── analytics/
│   │   ├── effort-score.ts
│   │   ├── fatigue.ts
│   │   ├── load.ts
│   │   └── ultra-ready.ts
│   │
│   ├── ai/
│   ├── database/
│   └── security/
│
├── supabase/
│   ├── migrations/
│   └── functions/
│
├── public/
│   ├── icons/
│   └── manifest.json
│
├── .env.local
├── .env.example
├── package.json
└── README.md
```

---

## 3. Les comptes à créer

Créer les comptes suivants avant de commencer :

### Obligatoire V1

- [x] GitHub  
- [x] Vercel  
- [x] Supabase  
- [x] Strava Developer  
- [ ] OpenAI ou Claude API — prévu pour Coach IA (reporté)  

### Plus tard

- [ ] Stripe, pour les abonnements
- [ ] Apple Developer, pour App Store
- [ ] Google Play Console, pour Play Store
- [ ] Garmin Developer Program
- [ ] Polar AccessLink
- [ ] Suunto Partner API

---

## 4. Étape 1 — Préparer le projet local ✅ FAIT

### Objectif

Créer le projet web app sur ton ordinateur.

### Actions

- [x] Installer Node.js (Node 20 LTS via nvm-windows)
- [x] Installer Git
- [x] Installer VS Code
- [x] Créer un dossier local

```bash
mkdir trail-cockpit
cd trail-cockpit
```

- [ ] Créer le projet Next.js

```bash
npx create-next-app@latest .
```

Réponses conseillées :

```txt
TypeScript: Yes
ESLint: Yes
Tailwind CSS: Yes
src directory: No
App Router: Yes
Turbopack: Yes
Import alias: Yes
```

- [ ] Tester en local

```bash
npm run dev
```

- [ ] Ouvrir dans le navigateur

```txt
http://localhost:3000
```

---

## 5. Étape 2 — Créer le repo GitHub ✅ FAIT

### Objectif

Mettre le code dans un coffre-fort en ligne.

### Actions

- [ ] Créer un nouveau repo GitHub

Nom conseillé :

```txt
trail-cockpit-webapp
```

- [ ] Initialiser Git en local

```bash
git init
git add .
git commit -m "Initial commit"
```

- [ ] Connecter le repo distant

```bash
git remote add origin https://github.com/TON_COMPTE/trail-cockpit-webapp.git
git branch -M main
git push -u origin main
```

### Règle importante

Ne jamais envoyer les secrets dans GitHub.

À ne jamais mettre en clair dans le code :

```txt
SUPABASE_SERVICE_ROLE_KEY
STRAVA_CLIENT_SECRET
OPENAI_API_KEY
CLAUDE_API_KEY
STRIPE_SECRET_KEY
WEBHOOK_SECRET
```

---

## 6. Étape 3 — Créer Supabase ✅ FAIT

### Objectif

Créer la base de données et l’authentification.

### Actions

- [ ] Aller sur Supabase
- [ ] Créer un projet
- [ ] Choisir une région proche de l’Europe
- [ ] Noter les informations suivantes :

```txt
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Fichier `.env.local`

Créer un fichier local :

```bash
touch .env.local
```

Ajouter :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Fichier `.env.example`

Créer aussi un exemple sans vraies clés :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=
STRAVA_WEBHOOK_VERIFY_TOKEN=
OPENAI_API_KEY=
APP_URL=
```

---

## 7. Étape 4 — Créer les tables principales ✅ FAIT

### Objectif

Préparer une base évolutive pour Strava, Garmin, Polar et Suunto.

### Tables minimum V1

- [x] `profiles` (+ colonnes athlète : max_hr, threshold_hr, resting_hr, ftp_watts, weight_kg, year_goal_km)
- [x] `provider_connections`
- [x] `activities`
- [x] `activity_metrics`
- [x] `daily_metrics`
- [x] `weekly_metrics`
- [x] `webhook_events`
- [x] `sync_jobs`
- [x] `coach_messages`
- [x] `admin_logs`

---

## 8. Table `profiles`

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  role text not null default 'user',
  subscription_status text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Rôles possibles :

```txt
user
premium
admin
super_admin
```

---

## 9. Table `provider_connections`

Cette table est très importante pour l’avenir.

Elle permet d’ajouter plusieurs fournisseurs :

```txt
strava
garmin
polar
suunto
coros
fit_file
```

```sql
create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_user_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scopes text,
  status text not null default 'active',
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 10. Table `activities`

```sql
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_activity_id text not null,
  sport_type text,
  start_time timestamptz,
  duration_sec integer,
  moving_time_sec integer,
  distance_m numeric,
  elevation_gain_m numeric,
  avg_hr numeric,
  max_hr numeric,
  avg_power numeric,
  calories numeric,
  external_training_load numeric,
  name text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_activity_id)
);
```

---

## 11. Table `activity_metrics`

```sql
create table public.activity_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  effort_score numeric,
  fatigue_impact numeric,
  intensity_score numeric,
  recovery_need numeric,
  detected_session_type text,
  notes jsonb,
  created_at timestamptz not null default now()
);
```

---

## 12. Table `webhook_events`

```sql
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text,
  provider_user_id text,
  provider_activity_id text,
  payload jsonb not null,
  status text not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);
```

---

## 13. Table `sync_jobs`

```sql
create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  job_type text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  payload jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text
);
```

Exemples de `job_type` :

```txt
import_activity
backfill_history
refresh_token
recalculate_metrics
generate_weekly_summary
```

---

## 14. Sécurité Supabase RLS

### Objectif

Chaque utilisateur ne doit voir que ses propres données.

À activer sur les tables :

- [ ] `profiles`
- [ ] `provider_connections`
- [ ] `activities`
- [ ] `activity_metrics`
- [ ] `daily_metrics`
- [ ] `weekly_metrics`
- [ ] `coach_messages`

Exemple :

```sql
alter table public.activities enable row level security;

create policy "Users can read own activities"
on public.activities
for select
using (auth.uid() = user_id);
```

Pour l’admin, prévoir des règles spécifiques ou passer par le backend avec `SUPABASE_SERVICE_ROLE_KEY`.

---

## 15. Étape 5 — Créer l’authentification utilisateur ✅ FAIT

### Objectif

Permettre aux utilisateurs de créer un compte.

### Pages à créer

- [x] `/login`
- [x] `/signup`
- [x] `/dashboard`
- [x] `/settings`
- [x] `/admin`

### Fonctionnalités

- [x] Connexion email / mot de passe
- [ ] Magic link plus tard
- [ ] Connexion Google plus tard
- [x] Redirection après connexion
- [x] Création automatique du profil dans `profiles`

---

## 16. Étape 6 — Créer la page admin ✅ FAIT (live)

### Objectif

Avoir un tableau de bord pour piloter l’app.

### URL

```txt
/admin
```

### Accès

Seulement si :

```txt
role = admin
ou
role = super_admin
```

### Widgets admin V1

- [x] Liste des utilisateurs (TabUsers + suppression avec confirmation)
- [x] Sync individuel ou en masse (TabSync + `/api/admin/sync`)
- [x] Derniers webhooks reçus (TabWebhooks via `webhook_logs` — migration 008)
- [x] Liste des déploiements (TabDeployments avec date+heure complète)
- [ ] Compteurs agrégés (utilisateurs actifs, activités importées, jobs en erreur) — partiellement moqué
- [ ] Utilisation IA — N/A tant que Coach IA reporté
- [ ] État des connecteurs (Strava actif/expiré par user)

---

## 17. Étape 7 — Créer l’app Strava Developer ✅ FAIT (prod configuré)

### Objectif

Permettre aux utilisateurs de connecter leur compte Strava.

### Actions

- [ ] Aller sur Strava Developer
- [ ] Créer une application
- [ ] Récupérer :

```txt
STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET
```

- [ ] Définir le domaine de callback

En local :

```txt
http://localhost:3000/api/strava/callback
```

En production :

```txt
https://trailcockpit.app/api/strava/callback
```

### Variables `.env.local`

```env
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback
```

### Variables Vercel production

```env
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=https://trailcockpit.app/api/strava/callback
```

---

## 18. Étape 8 — Créer le flux Strava OAuth ✅ FAIT

### Objectif

Connecter un utilisateur à Strava.

### Routes à créer

```txt
/app/api/strava/connect/route.ts
/app/api/strava/callback/route.ts
```

### Flux

```txt
1. L’utilisateur clique sur "Connecter Strava"
2. L’app l’envoie vers Strava
3. L’utilisateur accepte
4. Strava renvoie un code à l’app
5. Le backend échange ce code contre des tokens
6. Les tokens sont stockés côté backend
7. L’utilisateur est redirigé vers le dashboard
```

### Données à stocker

Dans `provider_connections` :

```txt
user_id
provider = strava
provider_user_id
access_token_encrypted
refresh_token_encrypted
expires_at
scopes
status = active
```

---

## 19. Étape 9 — Importer les activités Strava ✅ FAIT

### Objectif

Récupérer l’historique d’activités de l’utilisateur.

### Fonction à créer

```txt
/lib/providers/strava/sync.ts
```

### Actions

- [ ] Récupérer les activités Strava
- [ ] Éviter les doublons avec `provider_activity_id`
- [ ] Convertir en format commun `NormalizedActivity`
- [ ] Sauvegarder dans `activities`
- [ ] Créer un job de recalcul des métriques

### Format commun recommandé

```ts
type NormalizedActivity = {
  provider: string
  providerActivityId: string
  sportType: string
  startTime: string
  durationSec: number
  movingTimeSec?: number
  distanceM?: number
  elevationGainM?: number
  avgHr?: number
  maxHr?: number
  avgPower?: number
  calories?: number
  externalTrainingLoad?: number
  rawPayload: unknown
}
```

---

## 20. Étape 10 — Créer le webhook Strava ✅ FAIT

### Objectif

Recevoir automatiquement les nouvelles activités.

### Route à créer

```txt
/app/api/webhooks/strava/route.ts
```

### URL production

```txt
https://trailcockpit.app/api/webhooks/strava
```

### Principe

Quand une activité est créée sur Strava :

```txt
Strava → Webhook Trail Cockpit → webhook_events → sync_jobs → import activité → recalcul scores
```

### Important

Le webhook doit répondre vite.

Mauvais :

```txt
Recevoir webhook
→ tout importer
→ tout calculer
→ répondre à Strava
```

Bon :

```txt
Recevoir webhook
→ stocker l’événement
→ créer un job
→ répondre OK
→ traiter ensuite
```

---

## 21. Étape 11 — Moteur d’analyse Trail Cockpit ✅ FAIT

### Objectif

Transformer les activités en indicateurs simples.

### Fichiers

```txt
/lib/analytics/effort-score.ts
/lib/analytics/fatigue.ts
/lib/analytics/load.ts
/lib/analytics/ultra-ready.ts
```

### Indicateurs V1

- [ ] Score d’effort CES
- [ ] Fatigue 7 jours
- [ ] Charge chronique
- [ ] Fraîcheur
- [ ] Risque de surcharge
- [ ] Progression hebdomadaire
- [ ] Score Ultra Ready
- [ ] Type de séance détecté

### Résultat utilisateur

Au lieu d’afficher uniquement :

```txt
ATL / CTL / TSB
```

Afficher :

```txt
Fatigue actuelle : élevée
Risque de surcharge : modéré
Conseil : faire une séance facile aujourd’hui
```

---

## 22. Étape 12 — Coach IA ⏳ REPORTÉ (skeleton UI en place, backend à implémenter)

### Objectif

Permettre à l’utilisateur de discuter avec un coach intelligent.

### Pages

```txt
/coach
```

### Fonctionnalités V1

- [ ] Chat utilisateur
- [ ] Analyse de la dernière semaine
- [ ] Conseil du jour
- [ ] Feedback après séance
- [ ] Adaptation simple du plan
- [ ] Historique des messages

### Sécurité

Ne jamais envoyer inutilement toute la donnée brute.

Envoyer seulement un résumé utile :

```txt
- Objectif utilisateur
- Niveau
- 7 derniers jours
- 4 dernières semaines
- Fatigue actuelle
- Séance prévue
- Message utilisateur
```

---

## 23. Étape 13 — Déployer sur Vercel ✅ FAIT — https://trail-cockpit.vercel.app

### Objectif

Mettre l’app en ligne.

### Actions

- [x] Aller sur Vercel
- [x] Connecter GitHub
- [x] Importer le repo
- [x] Configurer les variables d’environnement (fix BOM PowerShell via scripts/fix-env-vars.js)
- [x] Lancer le premier déploiement

### Variables Vercel minimum

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=https://trailcockpit.app/api/strava/callback
STRAVA_WEBHOOK_VERIFY_TOKEN=
OPENAI_API_KEY=
APP_URL=https://trailcockpit.app
```

### Après déploiement

- [ ] Vérifier que la page d’accueil fonctionne
- [ ] Vérifier que l’inscription fonctionne
- [ ] Vérifier que la connexion fonctionne
- [ ] Vérifier que `/dashboard` fonctionne
- [ ] Vérifier que `/admin` est protégé

---

## 24. Étape 14 — Ajouter le domaine ⏳ À FAIRE

### Objectif

Avoir une vraie adresse propre.

Exemple :

```txt
https://trailcockpit.app
```

### Actions

- [ ] Acheter un domaine
- [ ] Ajouter le domaine dans Vercel
- [ ] Modifier les DNS chez le fournisseur du domaine
- [ ] Attendre la propagation
- [ ] Vérifier HTTPS

### À mettre à jour ensuite

Dans Strava Developer :

```txt
https://trailcockpit.app/api/strava/callback
```

Dans Vercel :

```env
APP_URL=https://trailcockpit.app
STRAVA_REDIRECT_URI=https://trailcockpit.app/api/strava/callback
```

---

## 25. Étape 15 — Tester Strava en production ✅ FAIT

### Checklist

- [x] Cliquer sur “Connecter Strava”
- [x] Accepter les permissions
- [x] Revenir sur Trail Cockpit
- [x] Vérifier que `provider_connections` contient la connexion
- [x] Lancer un import manuel
- [x] Vérifier que les activités arrivent dans `activities`
- [x] Vérifier que les scores sont calculés
- [x] Vérifier que le dashboard affiche les données

---

## 26. Étape 16 — Tester le webhook Strava ✅ FAIT (production)

### Checklist

- [x] Abonnement webhook créé côté Strava (production)
- [x] Endpoint validé par Strava (hub challenge OK)
- [x] Webhook délivre les events (Edge runtime, fenêtre 2s respectée)
- [x] `webhook_logs` reçoit l'événement (migration 008)
- [x] Retry/backoff sur fetch activité (0/3/8/20s) si pas encore disponible côté Strava
- [x] Activité importée et CES v2 calculé avec profil utilisateur
- [x] Soft-delete propre quand activité supprimée côté Strava
- [x] Dashboard mis à jour automatiquement

---

## 27. Étape 17 — Ajouter les tâches automatiques

### Objectif

Ne pas dépendre uniquement des webhooks.

### Cron jobs V1

- [ ] Sync de sécurité quotidien
- [ ] Recalcul des métriques quotidien
- [ ] Nettoyage des jobs échoués
- [ ] Résumé hebdomadaire

### Exemple

```txt
Chaque nuit :
- vérifier les connexions actives
- importer les activités manquées
- recalculer les scores
- générer un résumé
```

---

## 28. Étape 18 — Préparer la PWA ✅ FAIT (installable)

### Objectif

Faire ressembler la web app à une app mobile.

### Actions

- [x] Créer `manifest.json`
- [x] Ajouter les icônes (192px + 512px, générées en pur Node.js)
- [x] Ajouter le nom de l’app
- [x] Ajouter le thème couleur
- [x] Service worker (`web/public/sw.js`) avec enregistrement client
- [x] `InstallPrompt` component (instructions iOS spécifiques car Safari)
- [x] Layout meta tags (apple-mobile-web-app-capable, theme-color)
- [x] Tester l’installation sur Android (display: standalone OK)
- [x] Tester l’ajout à l’écran d’accueil sur iPhone
- [ ] Splash screen
- [ ] Notifications push (post-domaine personnalisé)

### Fichier

```txt
/public/manifest.json
```

Exemple :

```json
{
  "name": "Trail Cockpit",
  "short_name": "Cockpit",
  "description": "Coach trail intelligent et cockpit d’entraînement",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## 29. Étape 19 — Préparer l’avenir Play Store / App Store

### Objectif

Ne pas refaire le backend.

Le jour où la web app est stable :

```txt
Web app
   ↓
Capacitor
   ↓
Android Studio
   ↓
Play Store
```

Puis :

```txt
Web app
   ↓
Capacitor
   ↓
Xcode
   ↓
App Store
```

### À retenir

Le backend reste identique :

```txt
https://trailcockpit.app/api
```

Les apps mobiles deviennent juste des interfaces qui parlent au même backend.

---

## 30. Étape 20 — Préparer Garmin / Polar / Suunto

### Objectif

Ajouter d’autres sources de données sans casser l’app.

### Règle d’or

Ne jamais coder les calculs uniquement pour Strava.

Toujours passer par :

```txt
NormalizedActivity
```

### Structure provider

```txt
/lib/providers/
  strava/
    auth.ts
    sync.ts
    webhook.ts
    mapper.ts

  garmin/
    auth.ts
    sync.ts
    webhook.ts
    mapper.ts

  polar/
    auth.ts
    sync.ts
    webhook.ts
    mapper.ts

  suunto/
    auth.ts
    sync.ts
    webhook.ts
    mapper.ts
```

### Ordre conseillé

```txt
1. Strava
2. Import fichier FIT / GPX / TCX
3. Polar
4. Garmin
5. Suunto
6. Coros
```

Le fichier FIT manuel est important parce qu’il permet de commencer sans attendre l’accord Garmin ou Suunto.

---

## 31. Sécurité — Checklist obligatoire

Avant de donner l’app à des testeurs :

- [x] RLS activé sur les tables sensibles
- [x] Aucun secret dans GitHub
- [x] `.env.local` dans `.gitignore`
- [x] Page `/admin` protégée (rôle)
- [x] Service role uniquement côté serveur
- [x] Tokens Strava non visibles côté frontend
- [x] Webhook vérifié (hub challenge)
- [x] Logs webhook tracés (`webhook_logs` table — migration 008)
- [ ] Monitoring Vercel + alertes (Vercel Agent à configurer)
- [ ] Politique de confidentialité prête
- [ ] Suppression de compte utilisateur (auto-service RGPD)
- [x] Suppression utilisateur côté admin (TabUsers avec confirmation)
- [x] Déconnexion Strava prévue
- [x] Soft-delete activités (anti-résurrection au sync)
- [x] Scope OAuth Strava `activity:write` autorisé (suppression côté Strava)

---

## 32. Checklist MVP

Le MVP est prêt quand :

- [x] L’utilisateur peut créer un compte
- [x] L’utilisateur peut se connecter
- [x] L’utilisateur peut connecter Strava
- [x] L’app importe ses activités (avec sync 30j sliding window)
- [x] L’app calcule un score d’effort CES v2 (profile-aware FTP / allure seuil)
- [x] L’app affiche un dashboard simple (Cockpit grille de blocs swipeables)
- [x] L’app affiche fatigue 7j (ATL/CTL/TSB) avec confidence si historique < 42j
- [x] L'app affiche le détail d'une activité (carte Leaflet, splits, zones FC, stats, édition)
- [x] L'app permet d'éditer manuellement une activité (sport, intensité, métriques, suppression)
- [x] Profil athlète avec 6 modes de zones FC + recalcul historique CES + fatigue
- [ ] L’app affiche un conseil simple — Coach IA (reporté)
- [x] L’admin voit les utilisateurs (TabUsers, données réelles)
- [x] L'admin voit les webhooks (TabWebhooks via webhook_logs)
- [x] L'admin peut relancer un sync (TabSync individuel ou en masse)
- [x] L'admin voit les déploiements (TabDeployments avec date+heure)
- [x] Le webhook Strava fonctionne (Edge runtime + retry/backoff)
- [x] L’app est déployée sur Vercel — https://trail-cockpit.vercel.app
- [x] L'app est installable comme PWA (Android + iPhone)
- [ ] Le domaine fonctionne — à faire
- [x] Les données sont protégées par utilisateur (RLS)

---

## 33. Commandes utiles

### Lancer en local

```bash
npm run dev
```

### Installer une dépendance

```bash
npm install nom-du-package
```

### Vérifier le build

```bash
npm run build
```

### Linter

```bash
npm run lint
```

### Git

```bash
git status
git add .
git commit -m "message"
git push
```

---

## 34. Prompt pour Codex ou Claude Code

À copier dans Codex / Claude Code :

```txt
Tu es mon développeur senior full-stack. 
Je construis Trail Cockpit, une web app mobile-first destinée aux sportifs d’endurance.

Objectif :
Créer une web app Next.js + Supabase + Vercel, avec backend évolutif vers Play Store et App Store via Capacitor.

Contraintes importantes :
- Backend central indépendant du frontend
- Auth utilisateurs avec Supabase
- Page admin protégée par rôle
- Connexion Strava via OAuth
- Webhook Strava
- Architecture provider extensible pour Garmin, Polar, Suunto
- Normalisation des activités dans un format commun NormalizedActivity
- Ne jamais mettre les secrets dans le frontend
- Prévoir RLS Supabase
- Prévoir tables provider_connections, activities, activity_metrics, webhook_events, sync_jobs
- Prévoir moteur analytics séparé dans lib/analytics
- Prévoir future PWA
- Code TypeScript propre et maintenable

Commence par :
1. Auditer le projet existant
2. Créer la structure de dossiers recommandée
3. Ajouter Supabase client/server
4. Créer les migrations SQL
5. Créer auth utilisateur
6. Créer page dashboard
7. Créer page admin protégée
8. Créer flux Strava OAuth
9. Créer webhook Strava
10. Créer documentation .env.example

Avant chaque grosse modification :
- explique ce que tu vas faire
- fais des commits propres
- ne supprime rien sans demander
```

---

## 35. Ordre de travail conseillé avec l’IA

Ne demande pas tout d’un coup.

Faire par blocs :

```txt
Bloc 1 : structure projet + Supabase
Bloc 2 : auth utilisateur
Bloc 3 : page admin
Bloc 4 : Strava OAuth
Bloc 5 : import activités
Bloc 6 : webhook Strava
Bloc 7 : moteur analytics
Bloc 8 : dashboard utilisateur
Bloc 9 : coach IA
Bloc 10 : PWA
```

À chaque bloc :

```txt
1. L’IA code
2. Tu testes en local
3. Tu fais un build
4. Tu pushes sur GitHub
5. Vercel déploie
6. Tu testes en ligne
```

---

## 36. Règle finale à retenir

Ne construis pas :

```txt
Une app Android isolée
```

Construis :

```txt
Une plateforme sportive avec backend central
```

Ensuite, Android et iPhone seront seulement deux portes d’entrée vers le même système.

```txt
Web app aujourd’hui
PWA demain
Play Store ensuite
App Store après
```

