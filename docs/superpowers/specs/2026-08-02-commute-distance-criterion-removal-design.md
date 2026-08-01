# Matching TAF : suppression du critère de distance

**Date** : 2026-08-02
> **Status: Implémenté** · 2026-08-02 · Code: `web/lib/activities/commute.ts` (matchCommute), `web/components/settings/CommuteRoutesSection.tsx`

## Problème

Depuis le durcissement du matching (spec 2026-08-01), un trajet TAF exige :
bon sport + départ à ≤ `geo_tol_m` d'un point + arrivée à ≤ `geo_tol_m` de
l'autre. Le critère de distance (réf ± `distance_tol_pct` %) est devenu
redondant — un run qui part du domicile et arrive au bureau EST un trajet,
quelle que soit sa longueur — et il crée des **faux négatifs** : une variante
de parcours (détour, rallonge) sort de la fourchette et le TAF n'est plus
détecté.

Décision produit (Franck, 2026-08-02) : les points de départ/arrivée font foi,
**quelle que soit la distance**. Conséquence assumée : une sortie longue
volontaire qui se termine au bureau est taguée TAF.

## Objectif

Le kilométrage disparaît du matching et de l'UI des trajets. Seuls subsistent
comme critères : sport, points GPS (départ ET arrivée), tolérance géo.

## Design

### 1. Logique pure — `web/lib/activities/commute.ts`

Dans `matchCommute` : supprimer le filtre distance (le `continue` sur
`geo.distanceM == null` et le calcul de tolérance). La boucle devient :
sport → `resolveDirection` → match. Mettre à jour la JSDoc.

Inchangé : `CommuteGeo.distanceM` (toujours extrait — la création de trajet
s'en sert), les champs `refDistanceM`/`distanceTolPct` du type `CommuteRoute`
(la DB et l'API ne changent pas), `resolveDirection`, le fallback heure,
`matchCommuteByTitle`.

### 2. UI — `web/components/settings/CommuteRoutesSection.tsx`

- Carte d'un trajet : le sous-titre `{sportType} · réf {km} · ±{pct}%` devient
  `{sportType}` seul.
- Formulaire d'édition (RouteCard) : retirer le champ « Tol. dist. % » et son
  état `distTol` (patch inclus) ; il ne reste que « Tol. géo m » (pleine
  largeur, plus besoin de grille).
- Formulaire d'ajout (AddRouteForm) : retirer le champ « Tol. dist. % », son
  état `distanceTolPct`, son envoi dans le POST (le défaut DB 12 reste écrit,
  sans effet) ; « Tol. géo m » seul en options avancées.
- Texte d'aide de l'activité de référence : « C'est l'ALLER qui sert de
  référence : les points Home (départ) / Office (arrivée) en sont extraits. »
  (la mention de la distance disparaît).
- `formatKm` reste (utilisé par la liste des activités candidates).

### 3. Tests — `web/__tests__/activities/commute.test.ts`

- Le test « distance hors tolérance → null » s'inverse : distance très
  différente de la réf (ex. 9 000 m pour une réf 5 000) mais départ/arrivée
  corrects → **match** `outbound` (c'est le test du nouveau comportement).
- Nouveau : activité **sans champ distance** mais avec GPS départ/arrivée
  valides → match (le matching ne dépend plus de `distanceM`).
- Tout le reste (boucles → null, arrivée manquante → null, fallback heure,
  titre, vélotaf, casse du sport) inchangé.

### 4. Docs

Ajouter une section `## Drift notes` à
`docs/superpowers/specs/2026-08-01-commute-endpoint-matching-design.md`
(qui affirmait « le filtre distance reste en garde amont ») pointant vers la
présente spec.

## Hors scope

- Aucune migration : les colonnes `ref_distance_m` (NOT NULL, toujours écrite
  à la création) et `distance_tol_pct` restent en base.
- Aucun changement d'API : `distanceTolPct` reste accepté par POST/PATCH
  (l'UI ne l'envoie plus).
- Le champ « Tol. géo m » et l'éditeur de points ne changent pas.

## Vérification

- `npx jest __tests__/activities/commute.test.ts` vert (depuis `web/`).
- `npx tsc --noEmit` + `npm run lint` verts.
- Vérif manuelle Franck après déploiement : une variante longue de son TAF
  (hors ancienne fourchette ±12 %) est détectée ; une boucle depuis chez lui
  ne l'est toujours pas.
