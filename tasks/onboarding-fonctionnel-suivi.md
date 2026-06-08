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

## Lot 2 — Discipline → sport par défaut des blocs cockpit
- [ ] Helper `defaultSportForDiscipline()` (trail/route→run, vélo→ride, natation→swim, tri→all)
- [ ] `DashboardGrid` reçoit `discipline`, passe `defaultSport` aux 8 blocs sport-aware
- [ ] Chaque bloc : `localStorage override ?? defaultSport ?? DEFAULT_SETTINGS.default`
- [ ] `MISSION_VISIBLE` (Mode Mission) respecte le sport par défaut

## Lot 3 — Mission → bibliothèque Plan + séance clé + renommage route
- [ ] Renommage « Préparer un marathon » → « Préparer une course sur route » (10 km, semi, marathon), id `route`
- [ ] Migration SQL (`onboarding_race_date` + backfill `marathon`→`route`) — **à coller dans Supabase SQL Editor**
- [ ] Curation biblio par tags selon `onboarding_mission` (trail / route / libre)
- [ ] Séance clé épinglée en tête (trail→`co-4x4min`, route→`se-2x20`)
- [ ] Proposition B : champ date course **optionnel** si mission ∈ {trail, route} → `onboarding_race_date`
- [ ] Emphase Mode Mission `charge` (charge + freshness)

## Lot 4 — Édition dans Réglages (proposition D)
- [ ] Section `/settings` « Mon profil sportif » : discipline / mission / mode (+ date course)
- [ ] Bouton « Réappliquer les défauts d'affichage » (efface `cockpit_*_settings`)

## Lot 5 — Import manuel réel (2ᵉ temps, après lots 1–4)
- [ ] Flow d'upload GPX/FIT
- [ ] Bannière dashboard « Ajoute ta première activité » tant qu'aucune activité (amorce non bloquante)

## Hors périmètre (acté)
- Générateur de plan daté automatique
- Proposition C (niveau débutant/confirmé/expert) — refusée
