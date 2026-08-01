# Éditeur des points Home/Office d'un trajet TAF (carte + adresse)

**Date** : 2026-08-01

> **Status: Implémenté** · 2026-08-01 · Code: `web/components/settings/CommutePointsEditor.tsx`, `web/lib/geo/ban-geocode.ts`, `web/app/api/commute-routes/[id]/route.ts`

## Problème

Les points GPS d'un trajet domicile-travail (`home_lat/lng`, `office_lat/lng`)
sont extraits une seule fois de l'activité de référence à la création, puis
figés : aucune UI ne permet de les visualiser ni de les corriger, et le
`PATCH /api/commute-routes/[id]` ne les accepte pas. Si l'activité de référence
avait un départ/arrivée imparfait (montre lancée en retard, GPS dérivé), le
matching durci départ+arrivée (spec du 2026-08-01) produit des faux négatifs
sans recours utilisateur.

## Objectif

Sur un trajet **existant** (Réglages > Trajets domicile-travail), l'utilisateur
peut voir et corriger les deux points via un éditeur plein écran : recherche
d'adresse pour placer un point, puis ajustement fin en le déplaçant sur une
carte. La **création** de trajet reste inchangée (activité de référence
obligatoire — elle fournit aussi la distance).

## Design

### 1. API — `web/app/api/commute-routes/[id]/route.ts` (PATCH)

`PatchBody` gagne 4 champs optionnels : `homeLat`, `homeLng`, `officeLat`,
`officeLng` (numbers). Validation :

- Chaque valeur fournie doit être un nombre fini dans les bornes : lat ∈
  [-90, 90], lng ∈ [-180, 180], sinon **400**.
- Les points vont par paire : `homeLat` sans `homeLng` (ou l'inverse), idem
  Office → **400** (« point incomplet »). L'UI envoie toujours les 4.
- Mapping vers `home_lat`, `home_lng`, `office_lat`, `office_lng` dans le même
  style que les champs existants.

Aucune migration (colonnes existantes), aucun autre endpoint touché.

### 2. Géocodage — `web/lib/geo/ban-geocode.ts` (nouveau, logique pure + fetch)

- `type AddressHit = { label: string; lat: number; lng: number }`
- `parseBanResponse(json: unknown): AddressHit[]` — **pure, testée** : lit un
  GeoJSON BAN (`features[].properties.label`,
  `features[].geometry.coordinates` en ordre **[lng, lat]** — l'inversion est
  LE piège, couverte par un test), tolérante aux champs manquants (feature
  invalide ignorée).
- `searchAddress(q: string): Promise<AddressHit[] | null>` — fetch
  `https://api-adresse.data.gouv.fr/search/?q=<q>&limit=5` (gratuit, sans clé,
  CORS ouvert, appel client comme le reverse-geocode BigDataCloud existant),
  réponse non-ok ou erreur réseau → `null` (distinct de `[]` = aucun
  résultat ; l'éditeur affiche alors un message discret). URL de base en
  constante unique (si la BAN migre vers `data.geopf.fr/geocodage`, un seul
  endroit à changer).

### 3. Composant — `web/components/settings/CommutePointsEditor.tsx` (nouveau)

`'use client'`, chargé par `next/dynamic` avec `ssr: false` (Leaflet exige le
DOM) uniquement à l'ouverture.

- **Overlay plein écran** monté via `createPortal(document.body)` (règle
  projet pour tous les overlays plein écran), fond `--trail-bg`, en-tête avec
  le label du trajet + bouton fermer.
- **Carte Leaflet** (react-leaflet, mêmes tuiles OSM France
  qu'`ActivityMap` — constante d'URL locale, on ne touche pas à
  `ActivityMap`) : 2 marqueurs **draggables** 🏠 Home / 🏢 Office en
  `L.divIcon` emoji (évite les icônes par défaut de Leaflet, cassées avec les
  bundlers), `fitBounds` sur les 2 points à l'ouverture.
- **Point actif** : deux puces « 🏠 Home » / « 🏢 Office » (Home actif par
  défaut) ; un tap sur la carte déplace le point actif, le drag d'un marqueur
  déplace ce marqueur (et le rend actif).
- **Recherche d'adresse** : input avec debounce ~300 ms (min 3 caractères) →
  `searchAddress`, liste de suggestions ; un tap place le **point actif** sur
  la suggestion et recentre la carte. Échec réseau → message discret, la carte
  reste utilisable.
- **Enregistrer** : `PATCH` avec les 4 valeurs ; succès → `onSaved(points)` +
  fermeture ; échec → message d'erreur inline, l'éditeur reste ouvert.
  **Annuler** ferme sans rien envoyer (sémantique modale : rien n'est écrit
  avant Enregistrer).
- Caption près d'Enregistrer : « Après modification, relance “Appliquer à
  l'historique” pour re-détecter les trajets avec les nouveaux points. »
- Thème : tokens `--trail-*` uniquement, jamais de couleur en dur ; UI en
  français ; mobile-first (~390 px).

### 4. Intégration — `web/components/settings/CommuteRoutesSection.tsx`

- Sur chaque `RouteCard` : lien « Modifier les points Home / Office » à côté de
  « Modifier les titres & tolérances » → ouvre l'éditeur avec la route.
- `onSaved` met à jour l'état local `routes` (pas de refetch) — le PATCH est
  fait par l'éditeur.
- Le type local `CommuteRoute` du composant possède déjà
  `homeLat/homeLng/officeLat/officeLng`.

### 5. Tests — `web/__tests__/`

- `lib/geo/ban-geocode.test.ts` : `parseBanResponse` — cas nominal (label +
  inversion [lng,lat] → {lat,lng}), feature sans geometry/properties ignorée,
  json non conforme → `[]`.
- `app/api/commute-routes/patch-points.test.ts` (mock Supabase capturant le
  payload `.update()`, comme le pattern existant du projet) : 4 champs valides
  → update `home_lat`/… corrects ; lat hors bornes → 400 ; paire incomplète
  (homeLat sans homeLng) → 400 ; PATCH sans points (ex. `label` seul) →
  comportement existant intact.
- La carte Leaflet n'est pas testable en jsdom (comme `ActivityMap`, non
  testé) : la logique extraite (parse BAN, validation PATCH) porte les tests.

## Hors scope

- Création manuelle d'un trajet sans activité de référence.
- Modification de la distance de référence ou de la tolérance depuis l'éditeur
  (déjà éditables ailleurs).
- Relance automatique de « Appliquer à l'historique » après sauvegarde (le
  bouton existant suffit, un rappel textuel est affiché).
- Reverse geocoding (afficher l'adresse des points existants) — les marqueurs
  sur la carte suffisent.

## Vérification

- `npx jest __tests__/lib/geo/ban-geocode.test.ts __tests__/app/api/commute-routes/patch-points.test.ts`
  verts (depuis `web/`).
- `npx tsc --noEmit` + `npm run lint` verts (build local non autoritatif).
- Vérif manuelle Franck après déploiement : ouvrir l'éditeur sur son trajet,
  chercher une adresse, ajuster un marqueur, enregistrer, relancer « Appliquer
  à l'historique », vérifier la détection d'un vrai TAF.
