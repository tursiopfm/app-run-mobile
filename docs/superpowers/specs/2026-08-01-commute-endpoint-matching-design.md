# Détection des trajets TAF : vérifier départ ET arrivée

**Date** : 2026-08-01

> **Status: Implémenté** · 2026-08-01 · Code: `web/lib/activities/commute.ts` (resolveDirection), `web/components/settings/CommuteRoutesSection.tsx`

## Problème

La détection automatique des trajets domicile-travail (`matchCommute` /
`resolveDirection` dans `web/lib/activities/commute.ts`) ne vérifie que le
**point de départ** de l'activité. Conséquence : n'importe quel run de la bonne
distance (réf ± tolérance %) qui **part du domicile** est classé « aller TAF »,
même s'il se termine au domicile (boucle d'entraînement matinale). C'est le faux
positif constaté par Franck : run matinal ~9,5 km ± 12 % → renommé
`2026#N 🏠 Home…Office 🏢` à tort (en base + Strava), puis classé `runtaf` par
l'intensité.

Le point d'arrivée (`end_latlng`) est pourtant déjà extrait par
`extractCommuteGeo` (champ `CommuteGeo.end`) et les coordonnées Home/Office sont
déjà stockées sur chaque trajet (`home_lat/lng`, `office_lat/lng`, extraites de
l'activité de référence à la création). Il n'y a **aucune donnée nouvelle à
collecter** : il suffit d'utiliser l'arrivée dans le matching.

Constat annexe : le réglage « Bascule h » (`hour_split`) ne sert que de fallback
pour un trajet **sans** points GPS — cas impossible via l'UI (la création exige
une activité de référence avec départ ET arrivée GPS). Le champ est donc sans
effet pour tous les trajets réels et sème la confusion dans les réglages.

## Objectif

Une activité n'est classée TAF que si elle **part** de l'un des deux points du
trajet (Home ou Office, à `geo_tol_m` près) **et arrive** à l'autre. Une boucle
domicile → domicile ne matche plus jamais, quelle que soit sa distance.

Le durcissement vaut pour **tous les trajets, Runtaf (course) et Vélotaf
(vélo)** : `resolveDirection` est la logique commune à toutes les routes, le
sport n'intervient qu'en filtre amont (`route.sportType`) — aucun code
spécifique par sport.

## Design

### 1. Logique pure — `web/lib/activities/commute.ts`

`resolveDirection(geo, route)`, branche `routeHasGeo` uniquement :

- Si `geo.start == null` **ou `geo.end == null`** → `null` (pas de matching géo
  sans arrivée exploitable).
- `outbound` ⇔ départ à ≤ `geoTolM` de Home **et** arrivée à ≤ `geoTolM`
  d'Office.
- `return` ⇔ départ à ≤ `geoTolM` d'Office **et** arrivée à ≤ `geoTolM` de Home.
- Sinon → `null`. L'ancien départage `dHome <= dOffice` disparaît (devenu
  inutile : les deux extrémités sont vérifiées).

Inchangé :
- Le filtre distance (réf ± `distance_tol_pct` %) reste en garde amont dans
  `matchCommute`.
- Le fallback heure (`hourSplit`) pour les routes **sans** géo (cas dégénéré
  hérité) reste tel quel.
- `matchCommuteByTitle` (rattrapage par titre `YYYY#N …`) reste prioritaire et
  inchangé — c'est la voie de secours pour un vrai TAF dont le GPS n'a pas
  enregistré l'arrivée : Franck le nomme à la main, le titre le rattache.

### 2. UI — `web/components/settings/CommuteRoutesSection.tsx`

Retirer le champ « Bascule h » des deux formulaires (édition d'un trajet +
options avancées de l'ajout) ; les grilles passent de 3 à 2 colonnes
(« Tol. dist. % » et « Tol. géo m »). Nettoyage induit : état local `hourSplit`,
envoi dans le PATCH et le POST. La colonne DB `hour_split` (défaut 14) et le
champ API restent — aucune migration, le fallback dégénéré continue de
fonctionner pour d'éventuelles lignes historiques.

### 3. Tests — `web/__tests__/activities/commute.test.ts`

Cas à couvrir (nouveaux ou mis à jour) :
- **Boucle depuis Home** (départ Home, arrivée Home, distance dans la
  tolérance) → `null` — le faux positif d'origine, c'est le test qui doit
  échouer avant le fix et passer après.
- Vrai aller (départ Home, arrivée Office) → `outbound`.
- Vrai retour (départ Office, arrivée Home) → `return`.
- `geo.end == null` sur une route avec géo → `null`.
- Route sans géo → fallback heure inchangé (avant/après `hourSplit`).

## Hors scope

- **Nettoyage des runs déjà mal tagués** : ils gardent leur titre `2026#N …`
  (base + Strava) et seront toujours re-rattachés par le matching par titre.
  Franck les renomme à la main (retirer le préfixe `2026#N`) ; les trous de
  numérotation dans la séquence de l'année sont acceptés.
- Saisie/ajustement manuel des coordonnées GPS dans les réglages (approche B,
  écartée).
- Aucune migration Supabase, aucun changement d'API.

## Vérification

- `npx jest web/__tests__/activities/commute.test.ts` vert (lancer depuis
  `web/`).
- `tsc` + `eslint` verts (le build local est non autoritatif sur Windows).
- Vérif manuelle par Franck après déploiement : un run boucle depuis chez lui
  dans la fourchette de distance n'est plus renommé ; un vrai aller/retour TAF
  l'est toujours.
