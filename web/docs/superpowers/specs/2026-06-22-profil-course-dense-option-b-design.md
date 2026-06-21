# Profil altimétrique dense d'une course — Option B (trace GPX réelle)

> **Status: Spec validée** · 2026-06-22 · Auteur : Franck + Claude
> Suite de l'Option A (profil escalier, livré 2026-06-21). Réutilise le composant
> `ElevationProfileChart` et le highlight croisé construits en A.

## Contexte & objectif

L'Option A trace un profil « escalier » depuis les waypoints : **altitude réelle** pour les
imports LiveTrail (attribut XML `@_a`), mais **altitude relative reconstruite** (`d+ − d−`, libellé
« Altitude relative au départ ») pour les imports UTMB / LLM / l'historique — car ces sources
n'exposent ni altitude absolue ni coordonnées par waypoint.

Franck veut **l'altitude réelle, pas le relatif**. Le seul moyen de l'obtenir pour ces courses
est une **trace GPS dense avec `<ele>` réel** (GPX). L'Option B ingère cette trace, en stocke un
profil ré-échantillonné, et trace la **vraie courbe altimétrique lisse** en mètres réels — ce qui
fait disparaître le libellé « relatif » partout où une trace est attachée.

**Périmètre B :** acquisition d'une trace GPX (manuelle + auto-UTMB), pipeline de parsing /
ré-échantillonnage, stockage, et rendu dense (courbe réelle + ravitos superposés + highlight croisé).

**Hors périmètre :** carte du parcours (Leaflet) — explicitement reporté ; recalcul du D+/D-
officiel (on n'y touche pas) ; le mode escalier de l'Option A reste tel quel comme fallback.

## Décisions de cadrage (validées avec Franck)

1. **Livrable (a)** : le **vrai profil dense** (courbe lisse, mètres réels, ~quelques centaines de
   points). Pas de carte.
2. **Acquisition (iii)** : **GPX manuel** (upload fichier / collage URL) **ET** **auto-UTMB**
   (scraping `{event}.utmb.world/race/tracks` → GPX Cloudinary). Les deux alimentent le **même**
   pipeline ; l'auto-UTMB est un module d'acquisition isolé et **fail-soft**.
3. **D+/D- (a)** : le D+/D- **officiel** de la course n'est jamais touché. Le GPX sert
   **uniquement** à tracer la courbe `{km, altitude}` — **aucun calcul de D+** (on évite le piège
   de sur-estimation du dénivelé GPS).
4. **Rendu (a)** : courbe dense **+ waypoints/ravitos superposés** à leur km + **highlight croisé**
   tableau ↔ marqueur conservé. Escalier en fallback quand aucune trace.
5. **Acquisition UX (i)** : actions sur la **section « Profil de la course »** (bouton
   « Ajouter une trace GPX » → upload/URL ; menu remplacer/retirer). L'**auto-UTMB se déclenche
   automatiquement en arrière-plan, fail-soft**, après un import UTMB.

## Architecture & flux

```
Acquisition (2 voies)                  Pipeline commun (race-track/)        Rendu
─────────────────────                  ─────────────────────────────       ─────
Manuel: upload .gpx / URL ──┐
                            ├─► parseGpxTrack(xml) → {lat,lon,ele}[]        ElevationProfileChart
Auto-UTMB: /race/tracks ────┘   → distance cumulée (Haversine)              ├─ denseProfile présent →
  → Cloudinary .gpx              → resampleProfile(pts, distOfficielle)        courbe réelle + ravitos
  (auto, fire-and-forget,        → scale x sur distance officielle             + highlight croisé
   fail-soft)                    → { d:number[], e:number[] } (~qq centaines) └─ sinon → escalier (A, inchangé)
                                        │
                                        ▼
                                  race_tracks (gzip) ──► GET /waypoints renvoie aussi `track`
```

Le D+/D- officiel reste la source de vérité. Toute défaillance d'acquisition laisse l'escalier en place.

## Modèle de données

**Migration `045_race_tracks.sql`** — table `race_tracks`, relation 1:1 avec `races` :

```sql
create table if not exists race_tracks (
  race_id     uuid primary key references races(id) on delete cascade,
  profile_gz  text not null,        -- base64(gzip(JSON {d:number[], e:number[]}))
  point_count integer not null,
  source      text not null,        -- 'gpx_upload' | 'gpx_url' | 'utmb_auto'
  distance_m  integer,              -- distance brute du GPX (avant scaling), info/debug
  created_at  timestamptz not null default now()
);
-- RLS : accès via race_id → races.athlete_id (miroir des policies race_waypoints).
```

`profile_gz` stocke deux tableaux parallèles `d` (km cumulés) et `e` (altitude m), gzippés+base64
en miroir de `activity_streams.streams_gz`. Une seule trace par course (upsert : la dernière gagne).
Type `RaceTrack` ajouté à `web/types/plan.ts`.

À appliquer **manuellement** dans le SQL Editor Supabase avant déploiement (non auto-appliquée).

## Pipeline GPX (`web/lib/race-track/`)

Module **dédié** — on ne modifie PAS `web/lib/import/parse-gpx.ts` (utilisé par l'import
d'activités) pour ne rien casser.

- **`parse-gpx-track.ts`** : `parseGpxTrack(xml: string): { points: TrackPoint[]; distanceM: number }`
  avec `TrackPoint = { lat: number; lon: number; ele: number | null }`. Extrait les `<trkpt>`
  (lat/lon/`<ele>`), calcule la distance cumulée par Haversine (même formule que `parse-gpx.ts`).
  Lève si < 2 points exploitables.
- **`resample.ts`** : `resampleProfile(points, officialDistanceKm): { d: number[]; e: number[] }`.
  - Ré-échantillonne à **pas fixe ~75 m** (altitude interpolée linéairement) → ~quelques centaines
    de points. Borne supérieure dure (ex. 800 points) pour les très longs ultras.
  - **Scale l'axe distance** de `[0, distanceGpxKm]` vers `[0, officialDistanceKm]` pour que les
    ravitos (positionnés au km officiel) tombent au bon endroit sur la courbe.
  - **Aucun calcul de D+/D-** : on ne somme rien.
  - Points sans `ele` : ignorés à l'interpolation (trou comblé par les voisins ; si trop de trous,
    la trace est rejetée en amont).
- Tests purs : fixture GPX → nb de points borné, `d` strictement croissant, `e` = altitudes réelles
  interpolées, dernier `d` == `officialDistanceKm` (scaling).

## Acquisition

### Manuelle (UI — section « Profil de la course »)

Sur `CoursePageClient`, section Profil : si pas de trace, bouton « Ajouter une trace GPX » ouvrant
un petit dialog (composant `web/components/plan/AddTrackDialog.tsx`) :
- **Upload `.gpx`** : lu côté client (`FileReader`), envoie le texte.
- **Collage URL** : envoie l'URL, le serveur fetch (timeout court, taille bornée).
Une fois une trace présente : menu (kebab) « Remplacer » / « Retirer ».

### Auto-UTMB (`web/lib/race-track/utmb-tracks.ts`, server-only)

`fetchUtmbTrackGpx(raceUrl: string, officialDistanceKm: number): Promise<string | null>` :
1. Depuis l'URL de course UTMB (`{event}.utmb.world/.../races/{code}`), dérive la page
   `{event}.utmb.world/race/tracks`.
2. Fetch (timeout, taille bornée, fail-soft) ; parse les liens GPX Cloudinary (`res.cloudinary.com/.../*.gpx`).
3. **Matche la bonne distance** : heuristique sur le libellé/nom de fichier (distance présente),
   sinon le plus proche ; **si ambigu → renvoie `null`** (abandon silencieux).
4. Renvoie le **texte GPX** téléchargé, ou `null` à la moindre erreur.

**Déclenchement** : fire-and-forget après un import UTMB réussi (même pattern que
`searchAndStoreWebsite` dans `RaceEditorModal`/`CoursePageClient`) → appelle le pipeline → upsert
`race_tracks` avec `source='utmb_auto'`. **Jamais bloquant** : l'import du tableau réussit
indépendamment.

> ⚠️ **Risque connu** : la structure de `/race/tracks` et les URLs Cloudinary ne sont pas
> contractuelles (noms de fichiers saisis à la main). À l'implémentation, **vérifier le parsing
> contre une page UTMB réelle** et garder le module strictement fail-soft. C'est un confort, pas une
> dépendance dure : le manuel couvre 100% des cas.

## Rendu (`ElevationProfileChart` étendu)

Prop optionnelle `denseProfile?: { d: number[]; e: number[] }` :
- **Présente** → l'`AreaChart` trace les points denses (`d`→X km, `e`→Y altitude réelle, **axe en
  mètres, sans libellé « relatif »**). Les **waypoints** sont superposés en marqueurs (série de
  points) à leur km, altitude **interpolée sur la courbe dense** à ce km. Le **highlight croisé**
  reste piloté par `hoveredIndex`/`onHoverIndex` : survol d'une ligne du tableau → marqueur du
  waypoint correspondant mis en évidence (et inversement au survol d'un marqueur).
- **Absente** → comportement Option A **strictement inchangé** (escalier absolu/relatif).

`CoursePageClient` charge `track` (via le GET waypoints) et passe `denseProfile` quand il existe.
`buildProfileData` / `resolveAltitudes` (A) restent utilisés uniquement pour le fallback escalier.

## API

- **`POST /api/races/[id]/track`** — body, **une des trois variantes** :
  - `{ gpxText: string }` — GPX uploadé (lu côté client).
  - `{ gpxUrl: string }` — le serveur fetch l'URL (timeout court, taille bornée).
  - `{ utmbAuto: true }` — le serveur lit `race_tableau_meta.source_url` + `races.distance_km`,
    appelle `fetchUtmbTrackGpx`, et **si non-null** poursuit le pipeline avec `source='utmb_auto'`.
    Si `null` (host non-UTMB, scraping échoué, ambigu) → **204 No Content**, aucune écriture (fail-soft).
  Auth + ownership (via `races.athlete_id`). Pour les variantes GPX : parse → resample (avec la
  `distance_km` de la course) → upsert `race_tracks` → renvoie `RaceTrack`. Erreur 422 si le GPX est
  inexploitable (message clair).
- **`DELETE /api/races/[id]/track`** — supprime la trace (retour à l'escalier).
- **GET `/api/races/[id]/waypoints`** (existant) — renvoie **aussi** `track: RaceTrack | null`
  (un seul aller-retour pour la page).
- **Déclenchement auto-UTMB** : la variante `{ utmbAuto: true }` est appelée en **fire-and-forget
  côté client** après un import UTMB réussi (même pattern que `searchAndStoreWebsite`), jamais
  bloquant. Pas d'endpoint séparé : c'est une variante de `POST track`.

## Couverture & fallback

- Course avec trace attachée (manuel, ou auto-UTMB réussi) → **profil dense réel**, plus de relatif.
- Course UTMB sans trace (auto-UTMB échoué/non tenté) → escalier **relatif** (jusqu'à attache manuelle).
- Course LiveTrail → déjà escalier **absolu** (réel) en A ; une trace dense l'améliore en courbe lisse.
- Le libellé « Altitude relative au départ » ne subsiste donc que pour les courses **sans trace ET
  sans altitude absolue waypoint** — résorbable à tout moment en attachant un GPX.

## Tests (Jest)

- `parse-gpx-track` : fixture GPX (quelques `<trkpt>` avec `<ele>`) → points, distance Haversine,
  rejet si < 2 points.
- `resample` : pas fixe respecté, `d` croissant, dernier `d == officialDistanceKm` (scaling),
  interpolation d'altitude correcte, borne max de points.
- `utmb-tracks` : fixture page `/race/tracks` → sélection du bon lien GPX par distance ; ambiguïté
  / page vide → `null` (fail-soft).
- `ElevationProfileChart` : `denseProfile` présent → rend la courbe + marqueurs (pas l'escalier),
  pas de libellé « relatif » ; absent → escalier inchangé (non-régression A).
- `POST /api/races/[id]/track` : `gpxText` valide → 1 ligne `race_tracks` ; GPX pourri → 422.

## Fichiers touchés (récapitulatif)

| Fichier | Nature |
|---|---|
| `web/supabase/migrations/045_race_tracks.sql` | **neuf** — migration |
| `web/types/plan.ts` | type `RaceTrack` (+ `track` dans la réponse waypoints) |
| `web/lib/race-track/parse-gpx-track.ts` | **neuf** — parsing dense |
| `web/lib/race-track/resample.ts` | **neuf** — ré-échantillonnage + scaling |
| `web/lib/race-track/utmb-tracks.ts` | **neuf** — acquisition auto-UTMB (fail-soft) |
| `web/lib/race-track/storage.ts` | **neuf** — gzip/ungzip + upsert/read `race_tracks` |
| `web/app/api/races/[id]/track/route.ts` | **neuf** — POST (3 variantes dont `utmbAuto`) / DELETE |
| `web/app/api/races/[id]/waypoints/route.ts` | GET renvoie aussi `track` |
| `web/components/plan/RaceImportSheet.tsx` | trigger fire-and-forget `POST track {utmbAuto}` après import UTMB |
| `web/components/plan/ElevationProfileChart.tsx` | prop `denseProfile` + marqueurs + axe réel |
| `web/components/plan/AddTrackDialog.tsx` | **neuf** — upload/URL |
| `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` | charge + passe `track`, branche le dialog |
| `__tests__/...` | 5 suites (voir ci-dessus) |

## Déploiement

- **Migration `045` à appliquer manuellement dans Supabase AVANT le déploiement du code** (le POST
  track écrit dans `race_tracks` ; sans la table → 500 sur attache de trace ; la lecture tolère
  l'absence → `track: null`, escalier).
- `git push` → Vercel auto-deploy. Pas de `vercel --prod` CLI.

## Notes de cadrage

- **Pas de carte** (Leaflet) dans B — composant `ActivityMap` existant réutilisable plus tard si besoin.
- **Auto-UTMB = confort fail-soft**, pas une dépendance dure ; le manuel est le socle universel.
- **`parse-gpx.ts` (activités) non touché** ; nouveau module `race-track/` isolé.
- **D+/D- officiel intact** : la courbe dense n'alimente jamais le dénivelé de tête.
- **Non-régression A** : `denseProfile` absent → escalier identique au comportement livré 2026-06-21.
