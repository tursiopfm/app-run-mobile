# MINMAP - Navigateur rapide

Référence: [ARCHITECTURE.md](ARCHITECTURE.md) pour flux complet, [CLAUDE.md](../CLAUDE.md) pour chemins fichiers.

Ce fichier mappe les connexions écrans ↔ onglets ↔ briques techniques.

## Vue d'ensemble

```text
App Launch
  -> MainActivity
     -> Session chargee ?
        -> Non
           -> AuthScreen
              -> Onglet Connexion
              -> Onglet Creer un compte
              -> Succès auth -> save session -> DashboardScreen
        -> Oui
           -> DashboardScreen
              -> Cockpit
              -> Stats
              -> Charge
              -> Plan
              -> Activities
              -> CoursesRecords
              -> Reglages
              -> Ecran Edition Activite
              -> Ecran Layout Cockpit
              -> Ecran Profil Athlete
              -> Ecran Protocole Test FC
```

## Carte fonctionnelle

### 1. Entree application

- `MainActivity`
- role :
- charge la session
- charge le theme
- recupere les donnees dashboard
- lance le polling
- decide si l'utilisateur voit `AuthScreen` ou `DashboardScreen`

### 2. Authentification

- `AuthScreen`
- sous-onglets :
- `Connexion`
- `Creer un compte`
- connexions :
- utilise `AuthRepository`
- renvoie `AuthResult`
- sauvegarde la session via `SessionRepository` depuis `MainActivity`
- sortie :
- succes -> `DashboardScreen`

### 3. Dashboard principal

- `DashboardScreen`
- onglets bas :
- `Cockpit`
- `Stats`
- `Charge`
- `Plan`
- `Activities`
- `CoursesRecords`
- `Reglages`

## Connexions entre onglets et sous-ecrans

### Cockpit

- affiche les blocs visibles du cockpit
- peut ouvrir :
- `CockpitLayoutScreen` via l'icone de layout
- connexion Strava / sync Strava
- depend de :
- `RemoteDashboard`
- `SampleData`
- composants graphiques et KPI

### Stats

- affiche les statistiques historiques
- change selon la metrique choisie :
- `Km`
- `D+`
- `Load`
- `TSB`

### Charge

- affiche la charge d'entrainement et les tendances
- 4 graphiques : charge quotidienne (30j), fatigue vs capacite (EWMA), fraicheur, repartition intensite
- depend de `CesCalculator` et `TrainingLoadCalculator`
- `StatusCard` affiche `TrainingStatusLevel` (enum typé)

### Plan

- affiche les cycles d'entrainement
- s'appuie sur `DraftData.trainingCycles`
- relie la planification aux sessions de semaine

### Activities

- affiche la liste des activites recentes
- clic sur une activite :
- ouvre `ActivityEditScreen`
- permet de modifier :
- nom
- distance
- duree
- D+
- type
- intensite
- sauvegarde :
- `onUpdateActivity`
- backend -> refresh dashboard

### CoursesRecords

- suivi des competitions et records personnels
- deux sous-vues : `Courses` (liste) et `Records`
- ajout / edition via `RaceEditorDialog` et `RecordEditorDialog`
- recherche d'activite Strava pour lier un resultat

### Reglages

- gere :
- etat de connexion
- theme
- langue (FR / EN / systeme)
- sync Strava
- profil athlete (zones FC, poids, VMA)
- deconnexion

## Ecrans secondaires

### `CockpitLayoutScreen`

- gere les blocs visibles / caches
- permet de reorganiser l'ordre d'affichage
- retourne au dashboard principal

### `ActivityEditScreen`

- ecran de detail / edition pour une activite
- retour vers `Activities` apres sauvegarde reussie

### `AthleteProfileScreen`

- configure le profil : poids, sexe, FC max, VMA
- gere les zones cardiaques (manuel / deduites / mixte)
- lien vers `HeartRateTestProtocolScreen`

### `HeartRateTestProtocolScreen`

- guide le protocole de test FC max terrain
- retour vers `AthleteProfileScreen`

### `StravaAuthActivity`

- ouvre le lien OAuth Strava
- recoit le retour de connexion
- renvoie vers l'application mobile

## Connexions techniques

```text
MainActivity
  -> SettingsRepository
  -> SessionRepository
  -> BackendRepository
  -> StravaRepository
  -> StravaAuthActivity

AuthScreen
  -> AuthRepository

DashboardScreen
  -> RemoteDashboard / SampleData / DraftData
  -> UI components
  -> updateActivity -> BackendRepository

StravaAuthActivity
  -> AppConfig.stravaConnectUrl(...)
  -> backend/strava-oauth

backend/strava-oauth/server.js
  -> Strava API
  -> stockage local JSON / SQLite
  -> endpoints dashboard / sync / auth
```

## Fichiers pivots

- `app/src/main/java/com/franck/trailcockpit/MainActivity.kt`
- `app/src/main/java/com/franck/trailcockpit/StravaAuthActivity.kt`
- `app/src/main/java/com/franck/trailcockpit/ui/screens/AuthScreen.kt`
- `app/src/main/java/com/franck/trailcockpit/ui/screens/DashboardScreen.kt`
- `app/src/main/java/com/franck/trailcockpit/network/AuthRepository.kt`
- `app/src/main/java/com/franck/trailcockpit/network/BackendRepository.kt`
- `app/src/main/java/com/franck/trailcockpit/network/StravaRepository.kt`
- `app/src/main/java/com/franck/trailcockpit/config/SessionRepository.kt`
- `backend/strava-oauth/server.js`

## Zones a surveiller

- `DashboardScreen.kt` est central et tres volumineux
- la navigation est aujourd'hui interne a l'ecran plutot qu'appuyee sur un vrai systeme de routes
- certaines dependances entre mock, draft et backend reel sont encore melangees
- la sync Strava et le refresh dashboard sont des points critiques pour l'experience utilisateur

---

## Web App — Trail Cockpit (Next.js 14) — état 2026-05-09

```text
https://trail-cockpit.vercel.app
  -> /login        → Supabase Auth (email/password)
  -> /signup       → création compte + profil auto
  -> /auth/reset   → reset mot de passe
  -> /dashboard    → Cockpit (grille de blocs swipeables multi-sports, drag-and-drop)
  -> /activities   → liste + recherche + filtres intensité/date
  -> /activities/[id] → détail activité (carte Leaflet, splits, zones FC, stats, édition)
  -> /charge       → 4 graphiques (charge 30j, EWMA, fraîcheur, intensité)
  -> /courses      → compétitions et records
  -> /plan         → cycles d'entraînement
  -> /coach        → skeleton Coach IA (à implémenter)
  -> /settings     → Strava, apparence, langue (FR/EN/système)
  -> /profile      → profil athlète + 6 modes zones FC (séparé de settings)
  -> /admin        → TabUsers / TabSync / TabWebhooks / TabDeployments (rôle admin)
```

### Architecture Web

```text
web/
  app/
    (main)/                      → layout commun avec AppShell
      dashboard/page.tsx
      activities/page.tsx
      activities/[id]/page.tsx   → détail + carte + édition
      charge/page.tsx
      courses/page.tsx
      plan/page.tsx
      coach/page.tsx
      settings/page.tsx
      profile/page.tsx
      admin/page.tsx
    api/
      profile/route.ts            → PATCH profil athlète
      profile/recalculate/route.ts → recalcul CES + fatigue après modif profil
      activities/[id]/route.ts    → PATCH (édition) + DELETE
      strava/connect/route.ts
      strava/callback/route.ts
      strava/sync/route.ts        → 30j sliding window + soft-delete
      strava/disconnect/route.ts
      webhooks/strava/route.ts    → Edge runtime + retry/backoff
      admin/users/[id]/route.ts   → DELETE user (admin)
      admin/sync/route.ts         → relance sync user (admin)
      admin/deployments/route.ts
  components/
    navigation/
      AppShell.tsx                → header (nom user + ⋮ → /settings) + BottomNav
      BottomNav.tsx
    cockpit/                      → blocs swipeables multi-sports
      DashboardGrid.tsx           → orchestration drag/visibility
      WeekBlock.tsx               → semaine en cours
      HistoryBlock.tsx            → Sem./Mois/An
      ActivitiesBlock.tsx         → liste activités récentes
      ChargeBlock.tsx             → ATL/CTL/TSB par sport
      WeeklyStatsBlock.tsx        → km/D+ semaine
      CumulBlock.tsx              → cumul km annuel
      IntensityBlock.tsx          → donut intensité 30j
      GoalsBlock.tsx              → écart objectif annuel
      SportSettingsModal.tsx      → activer/désactiver sports
    activities/
      EditActivityModal.tsx       → édition sport/intensité/métriques + delete
      ActivityRow.tsx
      ActivityMap.tsx             → Leaflet (couches Plan/Sat/Relief, marqueurs km)
    settings/                     → ProfileSection, StravaSection, etc.
    InstallPrompt.tsx             → PWA install prompt (iOS-aware)
  lib/
    analytics/
      effort-score.ts             → CES v2 profile-aware (FTP, allure seuil, confidence)
      hr-zones.ts                 → 6 modes + getRecommendedHeartRateZoneMode
      fatigue.ts                  → buildFatigueResult + confidence (full/partial)
      load.ts, ultra-ready.ts
    sync/
      import-activities.ts
      recalculate-scores.ts       → recalcul batch CES + fatigue
      strava-mapper.ts
    sports/                       → SPORT_CONFIG, SPORT_TYPE_MAP, SportKey
    data/dashboard.ts             → SportOverview + sportOverviews
    database/                     → supabase-browser/-server/-service
  supabase/migrations/            → 8 migrations versionnées (001 → 008)
  public/
    sw.js                         → service worker PWA
    icons/icon-192.png, icon-512.png
    manifest.json
```

### Flux clés Web

```text
Auth :
  /login → Supabase Auth → middleware refresh session → /dashboard

Strava OAuth (scope incl. activity:write) :
  /settings → /api/strava/connect → strava.com → callback → provider_connections

Sync activités (30j sliding window) :
  /api/strava/sync → fetch Strava → NormalizedActivity → CES v2 (profil) → activities + activity_metrics
                  → soft-delete activités absentes côté Strava sur 30j → daily_metrics

Webhook Strava (Edge runtime, fenêtre 2s) :
  Strava → POST /api/webhooks/strava → webhook_logs → fetch activité (retry 0/3/8/20s)
        → CES v2 avec profil → upsert/soft-delete activities

Profil + recalcul :
  /profile → PATCH /api/profile → profiles
          → POST /api/profile/recalculate → recalculateUserEffortScores + recalculateUserFatigue

Édition activité :
  /activities/[id] → EditActivityModal → PATCH /api/activities/[id] → recalc CES → optimistic update

Cockpit :
  /dashboard → SportOverview[] (un par sport actif) → grille blocs swipeables
            → ordre + visibilité persistés localStorage
```

### Points de vigilance Web

- `AppShell` = Server Component, fetch nom user à chaque render — Next.js cache intelligemment
- Strava n'accepte qu'un seul callback domain → switcher local/prod côté Strava Developer
- Variables d'env Vercel : jamais via PowerShell pipe (BOM UTF-16) — utiliser `scripts/fix-env-vars.js` ou dashboard Vercel
- Webhooks Strava : Edge runtime obligatoire (cold start Node serverless > 2s = échec livraison)
- Soft-delete : ne jamais hard-delete une activité Strava (sync ressuscite si fenêtre 30j)
- CES v2 : `effort_score_version` doit être bumpé à chaque changement de formule pour permettre le recalcul ciblé

---

## Convention de mise a jour

Mettre a jour cette minmap des qu'un nouvel ecran, un nouvel onglet, un nouveau flux ou une nouvelle integration est ajoutee.
