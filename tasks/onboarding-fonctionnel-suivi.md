# Suivi — Onboarding fonctionnel

Spec : `web/docs/superpowers/specs/2026-06-08-onboarding-fonctionnel-design.md`
Principe : chaque sélection de l'onboarding produit un effet réel. Livraison **incrémentale, item par item**.

Légende : `[ ]` à faire · `[~]` en cours · `[x]` livré (date + commit).

## Lot 1 — Flow 6 étapes + Zones FC + Mode défaut — ✅ livré 2026-06-08 (branche `feat/onboarding-lot1-fc-mode`)
- [x] Flow passe à 6 étapes (`Bienvenue → Discipline → Mission → Mode → Zones FC → Données`) · `e91ee7bb`
- [x] Nouvelle étape **Zones FC** : bouton « Déduire automatiquement (recommandé) » → `hr_zone_method='deduced'` · `e91ee7bb`
- [x] Fallback « Je connais ma FC max » : 1 champ (FC max / année naissance) → `pct_max` / `auto` (bornes de plausibilité) · `e91ee7bb`
- [x] Étape FC skippable + encart « intensité / charge / fraîcheur » · `e91ee7bb`
- [x] Proposition A : collecte `birth_year` (via le fallback année de naissance) · `e91ee7bb`
- [x] `onboarding_mode` **semé** dans `ui_preferences.app_mode` à la complétion (2 chemins : `/api/profile` `2f780989`, callback Strava `c737cd40` ; helper `456f9537`). hydrate() le propage au client ; le toggle Réglages reste maître ensuite.

## Lot 2 — Discipline → sport par défaut des blocs cockpit — ✅ livré 2026-06-08 (branche `worktree-onboarding-lot2-discipline-sport`)
- [x] Helper `defaultSportForDiscipline()` : vélo→ride, natation→swim, tri→all, **trail/route→undefined** (pas de surcharge, garde les défauts par bloc) + `withDefaultSport()` · `0f2262c1`
- [x] `DashboardGrid` reçoit `discipline`, dérive `defaultSport`, le passe aux 8 blocs sport-aware · `60b06fee`
- [x] Chaque bloc : `localStorage override (readSportSettings) ?? defaultSport (withDefaultSport) ?? DEFAULT_SETTINGS.default` — perso utilisateur prioritaire · `60b06fee`
- [x] `MISSION_VISIBLE` (Mode Mission) respecte le sport par défaut (mêmes composants → héritent de `defaultSport`, rien à changer) · `60b06fee`
- [x] Test contrat LS-override-wins (`readSportSettings` + `withDefaultSport`)

## Lot 3 — Mission → bibliothèque Plan + séance clé + renommage route — ✅ livré 2026-06-08 (branche `feat/onboarding-lot3-mission-biblio`)
- [x] Renommage « Préparer un marathon » → « Préparer une course sur route » (10 km, semi, marathon), id `route` · `c6444b50`
- [x] Migration SQL 034 (`onboarding_race_date` + backfill `marathon`→`route`) · `f59d7903` — ⚠️ **à coller dans Supabase SQL Editor**
- [x] Curation biblio par `type` selon `onboarding_mission` (ordonnancement non destructif ; route=footing/seuil/VMA/SL/course, trail=footing/SL/tempo/côtes/course ; charge/libre inchangé) · `fb173440`
- [x] Séance clé épinglée en tête (trail→`co-4x4min`, route→`se-2x20`) · `fb173440`
- [x] Proposition B : champ date course **optionnel** si mission ∈ {trail, route} → `onboarding_race_date` · `c6444b50`
- [x] Emphase Mode Mission `charge` (bloc Charge mis en avant) · `7684d946`

## Lot 4 — Édition dans Réglages (proposition D) — ✅ livré 2026-06-08 (branche `feat/onboarding-lot4-settings`)
- [x] Section `/settings` « Mon profil sportif » : discipline + objectif (+ date course conditionnelle). FR codé en dur. Le **Mode** garde sa section « Mode d'affichage » dédiée existante (pas de doublon).
- [x] Bouton « Réappliquer les défauts d'affichage » (efface les 8 `cockpit_*_settings` + `notifyChange()`)

## Lot 5 — Import manuel réel (2ᵉ temps, après lots 1–4) — ✅ livré 2026-06-08 (branche `feat/onboarding-lot5-import`)
- [x] Flow d'upload **GPX** : parser pur `parseGpx` + `gpxToNormalized` (provider `gpx`, dédup hash) + route `POST /api/activities/import-file` (multipart, CES via profil FC) + carte Réglages « Import manuel » conforme Strava (sélecteur de sport)
- [x] Bannière dashboard « Ajoute ta première activité » tant qu'aucune activité (amorce non bloquante)
- [ ] **FIT** (fast-follow, hors v1) : parsing binaire `.fit` via lib
- [ ] Dédup cross-provider avec Strava (raffinement futur, accepté pour l'instant)

## Hors périmètre (acté)
- Générateur de plan daté automatique
- Proposition C (niveau débutant/confirmé/expert) — refusée
