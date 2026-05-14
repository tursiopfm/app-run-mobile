# Maintenance de l'application

Ce document sert de reference de maintenance pour `Trail Cockpit Android`.

Il a 3 objectifs :

- garder une trace claire de ce qui a deja ete mis en place
- preparer les prochaines mises a jour sans repartir de zero
- centraliser les points de vigilance techniques

## Resume du projet

- Application Android native en Kotlin + Jetpack Compose
- Backend local Node.js pour l'authentification et la synchronisation Strava
- Demarrage rapide via `start.bat` et `start-server.vbs`
- Base mobile orientee suivi trail, charge, statistiques, planification et activites

## Ce qui est deja en place

### Base application

- projet Android natif structure autour de `MainActivity`
- interface Compose avec theme et gestion de session
- stockage local des preferences et de la session utilisateur
- separation entre configuration, reseau, donnees et UI

### Authentification utilisateur

- ecran `AuthScreen` avec deux onglets :
- connexion
- creation de compte
- sauvegarde de session via `SessionRepository`
- bascule automatique vers le dashboard quand la session est chargee

### Dashboard principal

- ecran principal `DashboardScreen`
- navigation interne par barre d'onglets basse
- onglets disponibles :
- Cockpit
- Stats
- Charge
- Plan
- Activities
- Reglages

### Fonctions deja visibles dans l'app

- cockpit avec blocs configurables
- statistiques hebdo / annuelle
- charge d'entrainement
- plan / cycles de preparation
- liste des activites recentes
- edition d'une activite
- personnalisation de l'ordre et de la visibilite des blocs cockpit
- mode de theme
- deconnexion

### Integration Strava / backend

- lancement du flow Strava depuis l'application
- `StravaAuthActivity` pour ouvrir le lien OAuth
- callback mobile `trailcockpit://strava-auth`
- backend local dans `backend/strava-oauth`
- endpoints deja exposes pour healthcheck, connexion, sync, dashboard et activites
- polling regulier du dashboard depuis l'application
- synchronisation manuelle via l'interface

## Points de maintenance importants

- `MainActivity.kt` orchestre session, theme, synchro et affichage des ecrans
- `DashboardScreen.kt` concentre aujourd'hui une tres grosse partie de l'interface
- le backend Strava est encore pense comme un draft local, pas comme une architecture production
- certaines donnees restent mockees ou hybrides selon la disponibilite du backend
- les scripts Windows de demarrage font partie du fonctionnement quotidien du projet

## Historique des interventions connues

### Etat initial consolide

- suppression de l'ancienne tentative Expo pour garder une base Android unique
- alignement du draft avec les onglets du fichier Excel d'origine
- mise en place d'un cockpit mobile compilable
- preparation du flux Strava via backend local
- ajout d'une authentification utilisateur cote application
- ajout d'une gestion de session persistante
- ajout d'une edition d'activite
- ajout d'une personnalisation de layout pour le cockpit

## Historique des mises a jour

### 2026-05-01 - Revue de code et corrections post-i18n

**Contexte**
Revue systématique des erreurs introduites ou laissées ouvertes par la migration i18n (Codex).

**Corrections appliquées**

- `Models.kt` : remplacement de `TrainingStatus.status: String` par l'enum typé `TrainingStatusLevel { Rest, Fresh, Balanced, Loaded, Overloaded }` — supprime le risque d'encodage corrompu et de correspondance silencieuse
- `TrainingLoadCalculator.kt` : `computeStatusLabel()` retourne désormais `TrainingStatusLevel` (plus de strings françaises hardcodées)
- `DashboardScreen.kt` : suppression de `normalizedTrainingStatus()` et de ses variantes encodées en double UTF-8 (`Ã‰quilibrÃ©`, etc.) ; `StatusPill` et `statusRecommendation` utilisent directement l'enum
- `DashboardScreen.kt` : `historyPeriod` converti de `String` ("Semaine"/"Mois"/"Année") en `enum HistoryPeriod` avec `@StringRes labelRes` — empêche la rupture silencieuse sur locale EN
- `DashboardScreen.kt` : `PlanObjectiveEditorDialog` utilise désormais `stringResource(R.string.common_button_save/cancel/delete)`
- `DashboardScreen.kt` : chips Strava (Cockpit) utilisent `common_button_reconnect/connect/sync`
- `DashboardScreen.kt` : unités km/m dans KpiTiles utilisent `stringResource(R.string.unit_km/unit_m)`
- `DashboardScreen.kt` : sous-titre TSB utilise `cockpit_kpi_tsb_subtitle` (nouveau, avec paramètre `%d`)
- `DashboardScreen.kt` : valeur écran de démarrage dans Settings utilise `stringResource(R.string.dashboard_tab_cockpit)`
- `strings.xml` (FR + EN) : ajout de `common_button_delete` et `cockpit_kpi_tsb_subtitle`

**Fichiers**
- `data/Models.kt`
- `data/TrainingLoadCalculator.kt`
- `ui/screens/DashboardScreen.kt`
- `res/values/strings.xml`
- `res/values-fr/strings.xml`

**Impact**
- Compilation plus sûre (when exhaustif sur enum vs string libre)
- Localisation cohérente sur toutes les locales
- Suppression de l'artifact d'encodage qui causait un fallback silencieux sur "Repos"

**Problèmes non résolus (scope trop large pour cette passe)**
- C1/C2/C3 : onglet CoursesRecords et onglet Plan — dialogs et titres encore hardcodés en FR
- C5/C6 : protocole HR et profil athlète — sections partiellement migrées
- C7 : `defaultManualZones()` — noms de zones persistés en JSON, localisation structurellement complexe (non-composable)
- I6 : `format1()` utilise `"%.2f".format()` au lieu de `NumberFormat` avec locale explicite
- I4/I5 : quelques chips et labels dans l'onglet Activities pas encore migrés

---

### 2026-04-28 - Migration i18n complète (FR + EN)

**Fait**
- Plan i18n en 12 tâches, spec design, fondations strings (common/unit/error/format/sport/hr_zone)
- Migration `AuthScreen`, `WeekTable`, `KpiTiles`, `Charts`, `DraftCards`
- Migration `DashboardScreen` : onglets Cockpit, Stats, Charge, Activities, Settings
- Migration enums : `DashboardTab`, `SportMode`, `ChartPeriod`, `ActivitySearchField`, `ActivitySortCriterion`
- Ajout `values/strings.xml` (EN) + `values-fr/strings.xml` (FR) — 359+ clés chacun
- Fix référence non résolue après migration `ActivitySearchField`

**Fichiers**
- `ui/screens/DashboardScreen.kt` (toutes les migrations)
- `ui/components/` (Charts, KpiTiles, WeekTable, DraftCards)
- `ui/screens/AuthScreen.kt`
- `res/values/strings.xml` (nouveau)
- `res/values-fr/strings.xml` (nouveau)
- `docs/superpowers/specs/2026-04-28-i18n-design.md`
- `docs/superpowers/plans/2026-04-28-i18n.md`

**Impact**
- App localisable FR/EN via settings Android
- Les strings ne sont plus hardcodées dans le code Kotlin

---

### 2026-04 - Onglet Charge redessiné (CES / Blueprint)

**Fait**
- Ajout `CesCalculator.kt` (score effort par activité, multi-sports)
- Ajout `TrainingLoadCalculator.kt` (agrégation 30j, EWMA 7j/42j, fraîcheur)
- Onglet Charge redessiné avec 4 graphiques : charge quotidienne, fatigue/capacité, fraîcheur, répartition intensité
- Ajout onglet `CoursesRecords` pour le suivi des compétitions et records personnels
- Ajout `AthleteProfileSettings.kt`, `HeartRateZones.kt`, `SportConfig.kt`, `RaceRecords.kt`
- Profil athlète avec zones cardiaques configurables (manuel / déduit / mixte)

**Fichiers**
- `data/CesCalculator.kt` (nouveau)
- `data/TrainingLoadCalculator.kt` (nouveau)
- `data/AthleteProfileSettings.kt` (nouveau)
- `data/HeartRateZones.kt` (nouveau)
- `data/SportConfig.kt` (nouveau)
- `data/RaceRecords.kt` (nouveau)
- `ui/screens/DashboardScreen.kt` (refonte onglet Charge + ajout CoursesRecords)

**Impact**
- Score d'effort CES remplace Strava Suffer comme métrique principale
- Onglet Charge maintenant autonome, pas besoin du backend pour les courbes de charge

---

### 2026-04-24 - Optimisation documentation et tokens

**Fait**
- Créé `.claude/settings.json` avec allowlist bash/gradle
- Amélioré `.gitignore` (organisation, secrets, .env)
- Enrichi `CLAUDE.md` avec tableau chemins clés
- Créé `docs/ARCHITECTURE.md` (flux, couches, dépendances)

**Fichiers**
- `.claude/settings.json` (nouveau)
- `.gitignore` (amélioré)
- `CLAUDE.md` (amélioré)
- `docs/ARCHITECTURE.md` (nouveau)
- `docs/MAINTENANCE.md` (ce fichier)
- `docs/MINMAP.md` (inchangé, déjà excellent)

**Impact**
- Token budget réduit: architecture et chemins en CLAUDE.md
- Futures interactions plus rapides via settings.json et ARCHITECTURE.md
- .gitignore plus robuste (secrets, .env, binaires)

**Suite**
- Documenter formats backend quand API stabilisée
- Découper DashboardScreen.kt si liste onglets grandit
- Ajouter tests integration sur flux auth + sync

## Mises a jour prevues

Cette section sert de feuille de route vivante. A completer a chaque nouvelle demande.

### Priorite haute

- remplacer progressivement les donnees mockees par des donnees backend fiables
- decouper `DashboardScreen.kt` en sous-fichiers plus faciles a maintenir
- fiabiliser le parcours complet utilisateur + Strava + synchronisation
- clarifier la strategie de stockage backend pour sortir du mode draft

### Priorite moyenne

- ajouter des tests sur les repositories et les parcours critiques
- documenter les formats de donnees envoyes par le backend
- normaliser les noms des onglets, blocs et ecrans
- centraliser la configuration reseau et environnement

### Priorite basse

- enrichir les documents d'exploitation
- ajouter un changelog date par date
- documenter les procedures de publication et de sauvegarde

---

## Historique des mises à jour Web App

### 2026-05-09 — CES v2 profile-aware + HR zones refactor

**Contexte**
Refonte du moteur d'effort (CES v2) pour s'appuyer sur le profil athlète réel (FTP, allure seuil), avec gestion explicite de la confiance et des avertissements. Refonte des zones FC pour éliminer les chevauchements et s'aligner sur les standards physiologiques.

**CES v2 (profile-aware)**
- `web/lib/analytics/effort-score.ts` : `computeCesResult(activity, profile)` retourne désormais `confidence` (high/medium/low), `warnings[]`, `model` (power/pace_threshold/legacy), `version: 'v2.0'`
- Priorité IF : FTP utilisateur → FTP défaut → allure seuil utilisateur → allure seuil défaut → defaultIF
- Warnings auto : "renseigne ton allure seuil", "renseigne ton FTP", "le score trail utilise uniquement le D+"
- Migration 005 : colonnes `threshold_pace_run_sec_per_km` et `threshold_pace_trail_sec_per_km` sur `profiles`
- Migration 006 : colonne `effort_score_version` sur `activities`
- `web/lib/sync/recalculate-scores.ts` + `POST /api/profile/recalculate` : recalcul batch des CES de l'utilisateur après changement de profil (FTP, FC max, allure seuil)
- `recalculateUserFatigue()` mis à jour automatiquement après recalcul des scores
- Sync + webhook propagent désormais le profil utilisateur au calcul CES

**HR Zones**
- `web/lib/analytics/hr-zones.ts` : noms de zones corrigés, frontières sans chevauchement (zone N max = zone N+1 min - 1)
- `getRecommendedHeartRateZoneMode()` : logique de priorité (LTHR → AeT → FC max → estimation)
- Distribution avec loi normale tronquée plafonnée à la FC max réelle de l'activité
- `HeartRateZoneDistributionResult` expose `avg_max_estimate` quand l'activité n'a pas de FC max
- Synchronisation des zones d'activité avec le profil athlète (après update profil)

**Fatigue avec confiance < 42j**
- `buildFatigueResult()` : `confidence` (full/partial) + nombre de jours d'historique disponibles
- Affichage UI adapté quand l'historique est insuffisant pour le CTL 42j

**WorkoutType + intensité**
- Suppression des labels obsolètes `runtaf`, `velotaf`, `course` du type `IntensityKey`
- Ajout `recuperation` et `endurance_active` (anciennement Z3)
- Migration 007 : remappe les valeurs `manual_intensity` obsolètes en BDD
- Détection mot-clé corrigée : "côtes" / "cotes" reconnu comme intensité côte
- Plus de fallback CES → intensité (intensité = label saisi ou déduit du sport, jamais déduit du CES)

**Fichiers**
- `web/lib/analytics/effort-score.ts` (refonte v2)
- `web/lib/analytics/types.ts` (CesConfidence, CesModel, UserProfileForCes, CesResult.warnings/version)
- `web/lib/analytics/hr-zones.ts` (frontières + mode recommandé)
- `web/lib/analytics/fatigue.ts` (buildFatigueResult)
- `web/lib/sync/recalculate-scores.ts` (nouveau)
- `web/app/api/profile/recalculate/route.ts` (nouveau)
- `web/supabase/migrations/005_profile_threshold_pace.sql`
- `web/supabase/migrations/006_activity_effort_score_version.sql`
- `web/supabase/migrations/007_remap_obsolete_manual_intensity.sql`

**Impact**
- Score CES précis pour utilisateurs avec profil renseigné (FTP, allure seuil)
- UI peut afficher un avertissement "données manquantes" plutôt que d'afficher silencieusement un score imprécis
- Recalcul historique disponible quand le profil change

---

### 2026-05-09 — Migration 008 webhook_logs + soft-delete activités

**Contexte**
Sécuriser la suppression d'activités (résurrection au prochain sync) et tracer les webhooks Strava reçus pour debug.

**Fait**
- Migration 008 : table `webhook_logs` + colonne `deleted_at` sur `activities` (soft-delete)
- Webhook delete → soft-delete au lieu de hard-delete
- Sync 30j sliding window : soft-delete les activités absentes côté Strava sur 30 derniers jours
- Best-effort delete côté Strava (warning si activité GPS non supprimable via API)
- Scope OAuth Strava étendu à `activity:write` pour permettre la suppression
- Admin "TabSync" : route `/api/admin/sync` pour relancer le sync d'un user (ou en masse)
- Admin "TabUsers" : suppression utilisateur avec confirmation
- Admin "Deployments" : affichage date+heure complète

**Fichiers**
- `web/supabase/migrations/008_webhook_logs_and_soft_delete.sql`
- `web/app/api/webhooks/strava/route.ts`
- `web/app/api/strava/sync/route.ts`
- `web/app/api/admin/sync/route.ts` (nouveau)
- `web/app/api/admin/users/[id]/route.ts` (DELETE)
- `web/app/api/admin/deployments/route.ts`

**Impact**
- Suppression activité = définitive (plus de résurrection)
- Webhooks tracés en BDD pour diagnostic
- Admin peut piloter la sync utilisateur côté serveur

---

### 2026-05-08 — Cockpit web multi-sport (Phases 1–3) + drag-and-drop

**Contexte**
Refonte complète de l'onglet Cockpit web pour passer d'une vue mono-sport à une grille de blocs swipeables multi-sports, avec personnalisation utilisateur (visibilité, ordre, sports actifs).

**Phase 1 — Briques de base**
- `lib/data/dashboard.ts` : ajout `SportOverview` + `sportOverviews` (un par sport actif) avec `weeklyPoints`, `cumulMonths`, `intensityBreakdown`
- Constantes `SPORT_CONFIG`, `SPORT_TYPE_MAP`, `SportKey` (`web/lib/sports/`)
- `SportSettingsModal` pour activer/désactiver les sports affichés

**Phase 2 — Blocs swipeables**
- `WeekBlock` (semaine en cours, tabs sport)
- `HistoryBlock` (Sem./Mois/An — remplace HistoryPillsBlock + WeekTable)
- `ActivitiesBlock` (liste activités récentes par sport)
- `ChargeBlock` (charge ATL/CTL/TSB par sport)
- `WeeklyStatsBlock` (km/D+ semaine)
- `CumulBlock` (cumul km annuel)
- `IntensityBlock` (donut intensité 30j)

**Phase 3 — Personnalisation**
- `GoalsBlock` (carrousel multi-sport avec écart objectif annuel)
- Drag-and-drop reorder (long press, framer-motion)
- Hide/restore blocks + bouton "Ajouter un bloc"
- `AddBlockPanel` rendu via `createPortal` (fix overlay iOS/PWA)
- Persistance ordre + visibilité côté localStorage

**Polish**
- Donut intensité : labels gras, plus de pourcentage, carrés couleur 11px
- Badge effort coloré selon plage CES (bleu→rouge), icône Lucide `Dumbbell`
- Couleurs sport : Course→orange, Vélo→vert, Natation→bleu
- Emoji "Toutes" : ⚡ → 🌎
- Cumul km : étiquette dernière valeur de chaque mois + valeur du jour pour mois courant

**Fichiers**
- `web/components/cockpit/*.tsx` (11 nouveaux composants)
- `web/lib/data/dashboard.ts` (SportOverview)
- `web/lib/sports/*.ts` (SPORT_CONFIG, SPORT_TYPE_MAP)
- `web/components/cockpit/DashboardGrid.tsx` (orchestration drag/visibility)

**Impact**
- Cockpit web atteint la parité fonctionnelle avec l'app Android (et la dépasse sur drag-and-drop)
- Architecture modulaire : ajouter un nouveau bloc = 1 fichier sans toucher à la grille

---

### 2026-05-07 — Détail activité + édition + zones FC + carte interactive

**Contexte**
Fermer le manque "Détail d'activité" du plan migration web et brancher l'édition activité (sport, intensité manuelle, métriques, suppression).

**Détail activité (`/activities/[id]`)**
- Carte Leaflet avec marqueurs kilométriques, sélecteur de couches Plan/Satellite/Relief, satellite hybride
- Bouton fullscreen (refit bounds au toggle, refresh Leaflet après expand/collapse)
- Bouton vue cycling icône (bas-droite), positionné au-dessus de la BottomNav en mode étendu
- Onglets "Split" / "Zone FC" / "Stats" (3e onglet ajouté)
- Popup explicatif effort (vulgarisé) au clic sur la valeur
- Popup intensité avec liste des emoji et descriptions
- Poignée glassmorphism pour redimensionner la carte

**Édition activité**
- `EditActivityModal` : sport, intensité manuelle, métriques (distance, durée, D+), suppression
- API `PATCH /api/activities/[id]` (whitelist + sanitization body) + `DELETE /api/activities/[id]`
- Recalcul CES après édition (optimistic update)
- Bouton ⋮ dans la ligne activité ouvre la modale
- Fix calories vides : remplies au fetch détail Strava (endpoint /activities/{id})

**Liste activités**
- Filtre par type d'intensité (entre filtre "activité" et "date")
- Recherche live + filtre header + date picker
- Compteur résultats dans filtre, "Réinitialiser" ferme le panel
- Conservation recherche/filtre au retour depuis le détail
- Icône filtre orange si actif, gris sinon
- Centrage vertical valeur effort + emoji intensité

**Zones FC**
- Loi normale tronquée plafonnée à la FC max de l'activité
- Synchronisation avec profil athlète (changement profil → recalcul zones)

**Page Profil (séparée de Settings)**
- `/profile` (nouveau) : profil athlète, méthode de calcul des zones FC, source des valeurs
- Migrations 004 : ajout `aerobic_threshold_hr` et autres champs cardio sur `profiles`
- Modes zones FC : Seuils physio, Test terrain, Réserve FC/Karvonen, %FC max, Estimation auto, Personnalisé

**Fichiers**
- `web/app/(main)/activities/[id]/page.tsx` (nouveau)
- `web/app/(main)/profile/page.tsx` (nouveau)
- `web/components/activities/EditActivityModal.tsx` (nouveau)
- `web/app/api/activities/[id]/route.ts` (nouveau)
- `web/supabase/migrations/004_profile_cardio_fields.sql`

**Impact**
- Parité Android atteinte sur le détail activité
- Édition manuelle d'intensité disponible (utile pour activités sans données capteur)
- Zones FC cohérentes profil ↔ activité

---

### 2026-05-06 — PWA installable + Strava push webhook + mobile fixes

**Contexte**
Rendre l'app installable comme PWA et fiabiliser la synchronisation Strava (push + pull-to-refresh).

**PWA**
- Service worker (`web/public/sw.js`) + enregistrement client
- `InstallPrompt` component avec détection iOS (instructions différentes)
- `manifest.json` enrichi (icons, theme color, display: standalone)
- Layout meta tags (apple-mobile-web-app-capable, theme-color)

**Strava push webhook (production)**
- Edge runtime sur `/api/webhooks/strava` pour éliminer le cold start (Strava délivre en 2s ou abandonne)
- Traitement synchrone (drop `waitUntil`) dans la fenêtre 2s
- Retry fetch activité avec backoff (0/3/8/20s) si pas encore disponible côté Strava
- Logging verbeux pour diagnostic livraisons
- Pull-to-refresh sync sur mobile (overscroll natif)

**Mobile fixes**
- Défilement vertical Android (toutes pages — viewport + overflow)
- PTR overscroll fluide
- Foreground sync au retour sur la page
- Échappement apostrophes ESLint dans TabWebhooks

**Fichiers**
- `web/public/sw.js` + `web/components/InstallPrompt.tsx`
- `web/app/api/webhooks/strava/route.ts` (Edge runtime)
- `web/app/layout.tsx` (meta tags)

**Impact**
- App installable iPhone/Android comme PWA native
- Webhooks Strava livrés à >95% (vs cold start failures avant)
- Sync auto à chaque modif côté Strava

---

### 2026-05-04 — Mise en ligne + profil athlète + UX header

**Contexte**
Session complète de mise en production de la web app : stabilisation build, déploiement Vercel, configuration Strava prod, icônes PWA, profil athlète éditable, corrections UX header.

**STEP 6 — Stabilisation environnement Node / Build**
- Ajout `.nvmrc` (contient `20`) + champ `engines.node: 20.x` dans `package.json`
- Remplacement `next.config.mjs` → `next.config.js` (CJS) : le format ESM causait un blocage silencieux sur Windows après "Environments: .env.local"
- Ajout `web/scripts/build.js` : wrapper cross-platform qui catch l'erreur `ENOTEMPTY` de Node 20 sur Windows (Next.js 14 utilise `fs.rmdir` sur un dossier non vide), supprime `.next/export` puis relance le build
- Fix test `__tests__/lib/sync/import-activities.test.ts` : mock corrigé (`createClient` → `createServiceClient`, `mockResolvedValue` → `mockReturnValue`) — 43/43 tests passent

**STEP 7 — Merge → master**
- Fast-forward via `git update-ref refs/heads/master HEAD` (working tree Android modifié, pas de checkout possible)

**STEP 8 — Déploiement Vercel**
- Premier déploiement `vercel --prod` depuis `web/`
- Ajout `web/vercel.json` : framework nextjs, buildCommand npm run build, installCommand npm install
- App en ligne : https://trail-cockpit.vercel.app

**STEP 9 — Variables d'env + Strava prod**
- Fix critique BOM PowerShell : `"value" | vercel env add` ajoute U+FEFF (UTF-16 LE) sur toutes les valeurs → `client_id=%EF%BB%BF228003` dans l'URL Strava. Fix via `scripts/fix-env-vars.js` avec `spawnSync` + `input: Buffer.from(value, 'utf8')`
- Mise à jour Strava Developer : Authorization Callback Domain → `trail-cockpit.vercel.app`
- Mise à jour Supabase : Site URL + Redirect URL → `https://trail-cockpit.vercel.app/**`

**STEP 10 — Icônes PWA**
- Générateur `web/scripts/generate-icons.js` : encodeur PNG pur Node.js (CRC32 inline + zlib deflate + rendu RGBA par pixel)
- Design : fond `#0f1117` + rect arrondi `#f97316` + triangle montagne blanc (rendu barycentrique)
- Génère `public/icons/icon-192.png` (1151 B) et `public/icons/icon-512.png` (5516 B)

**STEP 11 — Profil athlète éditable**
- `web/app/api/profile/route.ts` : PATCH endpoint, whitelist des champs autorisés, update `profiles` Supabase
- `web/components/settings/ProfileSection.tsx` : composant client avec 8 champs (prénom, nom, FC max, FC seuil, FC repos, FTP, poids, objectif/an), bouton orange→vert→rouge selon statut
- `web/app/settings/page.tsx` : chargement server-side du profil, rendu de `ProfileSection` dans une SectionCard "Profil athlète"

**Corrections UX header**
- `AppShell` devient server component qui fetch lui-même `first_name`/`last_name` depuis `profiles` (fallback email)
- Nom affiché à gauche du `⋮` sur toutes les pages, sans threading de prop
- Bouton `⋮` (MoreVertical) → Link Next.js vers `/settings`
- Suppression du fetch `profiles` redondant dans `dashboard/page.tsx`

**Fichiers**
- `web/.nvmrc` (nouveau)
- `web/next.config.js` (nouveau, remplace .mjs)
- `web/scripts/build.js` (nouveau)
- `web/scripts/generate-icons.js` (nouveau)
- `web/vercel.json` (nouveau)
- `web/public/icons/icon-192.png` (nouveau)
- `web/public/icons/icon-512.png` (nouveau)
- `web/app/api/profile/route.ts` (nouveau)
- `web/components/settings/ProfileSection.tsx` (nouveau)
- `web/components/navigation/AppShell.tsx` (refonte)
- `web/app/settings/page.tsx` (mise à jour)
- `web/app/dashboard/page.tsx` (nettoyage)
- `web/package.json` (engines + build script)

**Impact**
- Web app en production sur Vercel — auth Strava fonctionnelle end-to-end
- Profil athlète éditable (FC, FTP, poids, objectif) persisté en Supabase
- PWA installable avec icônes réelles
- Header affiche le nom de l'utilisateur sur toutes les pages

**Reste à faire**
- STEP 12 : Coach IA (OpenAI/Claude + `coach_messages` Supabase) — reporté
- Zones cardiaques configurables (manuel / déduit)
- Détail activité et cockpit personnalisable
- Admin branché sur vraies données

---

## Migration Web App — État au 2026-05-09

### Ce qui est fait (web/)

**Fondations**
- Projet Next.js 14 bootstrappé dans `web/` (App Router, TypeScript, Tailwind)
- Supabase clients (browser + server + service role)
- Migrations DB : 8 migrations (initial schema, RLS, profil trigger, cardio fields, threshold_pace, effort_score_version, remap intensity, webhook_logs + soft-delete)
- Analytics : CES v2 profile-aware (`effort-score.ts`), HR zones (frontières corrigées), EWMA fatigue avec confidence, charge multi-sport, ultra-ready score
- Mapper Strava → NormalizedActivity ; skeletons Garmin / Polar / Suunto
- Tests Jest : analytics + mapper + zones FC

**Auth + middleware**
- Pages `/login`, `/signup`, `/auth/reset` avec Supabase Auth
- Middleware refresh session, protection `/admin`

**Strava (production)**
- OAuth `connect` → `callback` (CSRF state), `disconnect`
- Sync `POST /api/strava/sync` avec 30j sliding window pour propager renames/deletes
- Webhook Edge runtime (cold start <2s) avec retry/backoff sur fetch activité
- Soft-delete activités (déduplication anti-résurrection)
- Token refresh auto + scope `activity:write`

**Cockpit web (parité Android atteinte)**
- 11 blocs swipeables multi-sports (Week, History, Activities, Charge, WeeklyStats, Cumul, Intensity, Goals, etc.)
- Drag-and-drop reorder + hide/restore + bouton "Ajouter un bloc"
- `SportSettingsModal` pour activer/désactiver les sports
- Persistance ordre + visibilité localStorage

**Onglets**
- `/dashboard` — Cockpit complet avec drag-and-drop
- `/activities` + `/activities/[id]` — liste, recherche/filtre, détail avec carte Leaflet (couches, marqueurs km, fullscreen), édition modale
- `/charge` — 4 graphiques (charge 30j, EWMA, fraîcheur, intensité)
- `/courses` — compétitions et records
- `/plan` — cycles d'entraînement
- `/coach` — skeleton (à implémenter)
- `/settings` — Strava, apparence, langue (FR/EN/système avec localStorage), profil
- `/profile` — profil athlète + 6 modes de zones FC (séparé de Settings)
- `/admin` — TabUsers (delete), TabSync (sync individuel/masse), TabWebhooks, TabDeployments

**Profil athlète + recalcul**
- Profil éditable (FC max, AeT, LTHR, FC repos, FTP, allure seuil run/trail, poids, année naissance, objectif/an)
- Zones FC : 6 modes de calcul (priorité auto via `getRecommendedHeartRateZoneMode`)
- `POST /api/profile/recalculate` : recalcul batch CES + fatigue après modif profil
- `effort_score_version` tracé sur chaque activité

**PWA + production**
- Service worker + InstallPrompt (iOS instructions)
- Icônes 192×192 + 512×512
- Manifest standalone, theme color
- Déployée sur https://trail-cockpit.vercel.app
- Push webhook Strava configuré en prod

### Ce qui reste à faire (web/)

**Coach IA** — reporté, à faire plus tard
- [ ] Implémentation fonctionnelle (skeleton UI actuel)
- [ ] Connexion API OpenAI/Claude + historique `coach_messages`
- [ ] Résumé hebdo auto, conseil du jour, adaptation plan

**Infrastructure**
- [ ] Domaine personnalisé (trailcockpit.app ou équivalent)
- [ ] Strava multi-clients API (un seul callback domain à la fois)
- [ ] Import FIT / GPX / TCX manuel

**Polish (issus de TODO V2)**
- [ ] Popup intensité : retirer emoji début de ligne (redondance label)
- [ ] Détail activité : retirer bloc CES de l'onglet STATS
- [ ] Lien ⋮ header : `/settings` → `/profile`
- [ ] Cockpit "Semaine en cours" : sélection par défaut ALL → RUN, redesign 7 cartes horizontales
- [ ] Historique vue "An" : afficher D+ par mois

## Procedure de mise a jour de ce fichier

Pour chaque intervention, ajouter :

1. la date
2. ce qui a ete modifie
3. les fichiers concernes
4. les risques ou impacts
5. la suite recommandee

## Modele d'entree

```md
## 2026-04-24

### Fait
- ...

### Fichiers
- app/src/main/...
- backend/...

### Impact
- ...

### Suite
- ...
```
