# Profil altimétrique d'une course — Option A (profil escalier)

> **Status: Spec validée** · 2026-06-21 · Auteur : Franck + Claude
> Phase A d'un chantier en deux temps. L'Option B (profil dense depuis GPX officiel)
> fera l'objet d'un spec séparé ultérieur.

## Contexte & objectif

La page d'une course (`/plan/courses/[id]`) affiche un placeholder « Profil dénivelé — bientôt ».
On veut le remplacer par un **vrai profil altimétrique** tracé à partir des waypoints
(ravitos / points de passage) déjà importés, sans aucun nouvel appel réseau externe.

**Découverte fondatrice :** le parser LiveTrail lit déjà l'altitude absolue de chaque point
(`@_a` dans `parcours.php`) mais la **jette** après s'en être servi pour calculer le D-.
Par ailleurs, l'altitude *relative au départ* d'un point vaut exactement `d_plus − d_moins`,
deux valeurs déjà stockées en base pour **toutes** les courses. Le profil escalier est donc
soit lisible directement (LiveTrail, altitude absolue), soit reconstructible (tout le reste).

**Périmètre Option A (cette spec) :** stockage de l'altitude par waypoint, helper de résolution
absolu/relatif, composant graphique Recharts, colonne « Alt » dans le tableau, highlight croisé
graphe ↔ tableau.

**Hors périmètre (Option B, plus tard) :** trace GPS dense (~1500 pts), scraping du GPX
officiel UTMB/Cloudinary, recalcul d'altitude par MNT (IGN/OpenTopoData), table de profil dense.

## Décisions de cadrage (validées avec Franck)

1. **Emplacement & interactivité (b)** : remplace le placeholder sur la page course, graphe
   interactif avec tooltip, et **highlight croisé** bidirectionnel avec le tableau juste en dessous.
2. **Modèle de données (A3)** : on **stocke** l'altitude par waypoint (colonne dédiée) et on
   **affiche l'altitude de chaque ravito** dans le tableau, en plus du graphe.
3. **Backfill (ii) pur** : **aucun** re-fetch des sources, **aucun** bouton « rafraîchir ».
   L'ancien historique garde `altitude = NULL` et tombe sur le mode relatif (reconstruit). Les
   nouveaux imports LiveTrail remplissent l'altitude absolue automatiquement.

## Source de l'altitude par source d'import

| Source d'import | Altitude absolue par point ? | Mode résultant |
|---|---|---|
| **LiveTrail** (`parcours.php`, attribut `@_a`) | **Oui** (déjà lue, aujourd'hui jetée) | **absolu** |
| **UTMB** (JSON `points`) | Non — uniquement `gainElevation`/`lossElevation` cumulés | relatif |
| **LLM** (PDF / image / texte / URL générique) | Non — on ne demande **pas** l'altitude au LLM (peu fiable sur les valeurs de courbe) | relatif |
| **Historique déjà importé** (avant cette feature) | Non (`altitude = NULL`) | relatif |

## Architecture

### 1. Modèle de données & persistance

- **Migration `044_waypoint_altitude.sql`** :
  ```sql
  alter table race_waypoints add column altitude integer; -- mètres absolus, NULL si inconnu
  ```
  À appliquer **manuellement** dans le SQL Editor Supabase (rappel à Franck — non auto-appliqué).

- **Type** `RaceWaypoint` (`web/types/plan.ts`) : ajout `altitude: number | null`.
  Comme `ExtractedRaceData.waypoints = Omit<RaceWaypoint, 'id' | 'raceId'>`, tous les
  constructeurs de waypoint doivent désormais fournir `altitude`.

- **Constructeurs de waypoint** (ajout du champ `altitude`) :
  - `mapPointsBlock` (`sources/livetrail.ts`) → `altitude` = la valeur déjà lue (`num(p['@_a'])`,
    variable locale `altitude` ligne ~171, aujourd'hui non retournée).
  - `mapUtmbPoint` (`sources/utmb.ts`) → `altitude: null` (UTMB n'expose pas d'altitude absolue).
  - `rawToExtractedRaceData` (`schema.ts`, chemin LLM) → `altitude: null`.

- **Mapper DB→TS** `rowToRaceWaypoint` + type `DbRow` (`schema.ts`) : lire `altitude`
  (`altitude: row.altitude ?? null`).

- **Sites d'écriture DB** (ajout de `altitude` dans le row construit) :
  - `app/api/races/[id]/waypoints/route.ts` (PUT — sauvegarde manuelle **et** application d'import).
  - `app/api/races/[id]/tableau-recheck/route.ts` (`toRow` — application d'un diff de re-check).

- **JSON Schema LLM** (`RACE_EXTRACTION_JSON_SCHEMA`) : **inchangé**. On n'ajoute pas `altitude`
  aux champs demandés au modèle (décision : le LLM hallucine les valeurs numériques de courbe).

- **Diff de re-check** (`waypoint-diff.ts`, `WaypointFieldChange`) : **inchangé**. L'altitude
  n'entre pas dans la comparaison de fraîcheur (YAGNI). Lors de l'application d'un re-check
  LiveTrail, les nouveaux waypoints portent l'altitude fraîche et écrasent l'ancienne — suffisant.

### 2. Résolution de l'altitude (helper pur)

Nouveau dans `web/lib/plan/waypoint-view.ts` (foyer des dérivations d'affichage) :

```ts
export interface AltitudeInput { altitude: number | null; dPlus: number | null; dMoins: number | null }
export interface ResolvedAltitudes {
  mode: 'absolute' | 'relative'
  values: Array<number | null>   // même longueur que l'entrée ; null si point inexploitable
}

// Règle : si le DÉPART a une altitude stockée → mode absolu pour toute la course
// (les points sans altitude stockée sont reconstruits via départ + (d+ − d−),
// car d+ − d− = altitude − altitudeDépart). Sinon → mode relatif (d+ − d−).
export function resolveAltitudes(wps: AltitudeInput[]): ResolvedAltitudes
```

- **Mode absolu** (`wps[0].altitude != null`) :
  `value_i = wps[i].altitude ?? (d+ et d− connus ? altitudeDépart + d+_i − d−_i : null)`.
- **Mode relatif** (départ sans altitude) :
  `value_i = (d+ et d− connus) ? d+_i − d−_i : null`.

Un seul axe, jamais de mélange d'échelles. Le mode décide aussi le libellé de l'axe Y et
le formatage de la colonne « Alt ».

### 3. Composant graphique `ElevationProfileChart`

Nouveau `web/components/plan/ElevationProfileChart.tsx` (Recharts, déjà au projet).

- `AreaChart` : X = distance cumulée (km), Y = altitude résolue. Points = waypoints, reliés en
  **aire à interpolation linéaire** (pas de marches littérales). Léger dégradé sous la courbe,
  cohérent avec les design tokens existants.
- **Mode absolu** → axe Y en mètres réels (« 1850 m »). **Mode relatif** → axe Y signé vs départ
  (« +1240 m »), avec un libellé d'axe explicite « altitude relative au départ ».
- **Tooltip** au survol : nom du point, km, altitude (résolue), D+/D- cumulés.
- **Props** : `waypoints`, `hoveredIndex: number | null`, `onHoverIndex(i: number | null)`.
  Le point d'index `hoveredIndex` est mis en évidence (dot actif).
- **État vide** : si moins de 2 points exploitables (values non-null), afficher un placeholder
  discret au lieu du graphe.

### 4. Tableau : colonne « Alt » + highlight croisé

- `web/components/plan/WaypointsTable.tsx` :
  - **Colonne « Alt »** ajoutée **après « D- »**, **lecture seule** (mesure dérivée ; D+/D-
    restent éditables et pilotent le relatif). Affichage compact : valeur sans unité répétée,
    unité dans l'en-tête (« Alt (m) »). Mode relatif → valeur signée (« +1240 »).
  - Props ajoutées : `hoveredIndex`, `onHoverIndex`. Survol d'une ligne → `onHoverIndex(i)` ;
    la ligne `hoveredIndex` reçoit un fond de surbrillance.
- `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` :
  - État `hoveredWaypointIndex` remonté dans ce parent commun.
  - Remplacement du placeholder (Section « Profil de la course ») par `<ElevationProfileChart>`.
  - Le graphe et le tableau partagent `hoveredWaypointIndex` / `setHoveredWaypointIndex`
    → highlight **bidirectionnel** (survol graphe ↔ survol ligne).

## Flux de données

```
Import (LiveTrail)  → mapPointsBlock renseigne altitude (@_a)  ─┐
Import (UTMB/LLM)   → altitude: null                            ├─→ PUT waypoints (altitude) → DB
Re-check LiveTrail  → toRow renseigne altitude                 ─┘
DB → rowToRaceWaypoint (altitude) → RaceWaypoint[]
  → resolveAltitudes(wps) → { mode, values }
      ├─→ ElevationProfileChart (trace values, libelle selon mode)
      └─→ WaypointsTable colonne « Alt » (formate values selon mode)
CoursePageClient: hoveredWaypointIndex partagé ↔ highlight croisé
```

## Gestion des cas limites

- **Course sans aucun d+/d-** (rare, import dégradé) : toutes les `values` à null → graphe en
  état vide, colonne « Alt » affiche « — ».
- **Points intermédiaires sans altitude en mode absolu** : reconstruits via `départ + (d+ − d−)`.
- **Mode relatif** : baseline au départ = `0 − 0 = 0`, cohérent.
- **Course mono-source garantie** : une course est importée d'une seule source → pas de mélange
  réel absolu/relatif ; la règle « le départ décide » couvre néanmoins les éditions manuelles.

## Tests (Jest)

- `__tests__/lib/plan/waypoint-view.test.ts` : `resolveAltitudes`
  - départ avec altitude → mode absolu ; point intermédiaire null reconstruit ;
  - départ sans altitude → mode relatif (`d+ − d−`) ;
  - d+/d- null → value null.
- `__tests__/lib/race-import/livetrail.test.ts` : `mapPointsBlock` retourne `altitude` = `@_a`
  pour chaque point (fixture XML avec `a="..."`).
- `__tests__/lib/race-import/utmb.test.ts` : `mapUtmbPoint` retourne `altitude: null`.
- `__tests__/lib/race-import/schema.test.ts` : `rowToRaceWaypoint` expose `altitude` ;
  `rawToExtractedRaceData` met `altitude: null`.

## Fichiers touchés (récapitulatif)

| Fichier | Nature |
|---|---|
| `web/supabase/migrations/044_waypoint_altitude.sql` | **neuf** — migration |
| `web/types/plan.ts` | `RaceWaypoint.altitude` |
| `web/lib/race-import/sources/livetrail.ts` | persiste `@_a` |
| `web/lib/race-import/sources/utmb.ts` | `altitude: null` |
| `web/lib/race-import/schema.ts` | `rawToExtractedRaceData`, `DbRow`, `rowToRaceWaypoint` |
| `web/app/api/races/[id]/waypoints/route.ts` | row + `altitude` |
| `web/app/api/races/[id]/tableau-recheck/route.ts` | `toRow` + `altitude` |
| `web/lib/plan/waypoint-view.ts` | helper `resolveAltitudes` |
| `web/components/plan/ElevationProfileChart.tsx` | **neuf** — graphe |
| `web/components/plan/WaypointsTable.tsx` | colonne « Alt » + hover |
| `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` | branche graphe + état partagé |
| `__tests__/...` | 4 suites (voir ci-dessus) |

## Déploiement

- Push GitHub → Vercel auto-deploy (pas de `vercel --prod` CLI).
- **Migration `044` à appliquer manuellement dans Supabase AVANT le déploiement du code.**
  Les rows construits incluront `altitude` ; si la colonne n'existe pas, **toute** écriture de
  waypoint échoue (édition manuelle, application d'import, application de re-check), pas seulement
  les nouveaux imports. La lecture (mode relatif des anciennes courses) ne dépend pas de la colonne.
```
