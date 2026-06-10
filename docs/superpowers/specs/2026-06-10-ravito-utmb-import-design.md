# Import auto des ravitaillements UTMB + 5 catégories — Design

**Date :** 2026-06-10
**Statut :** À implémenter

## Objectif

Remplir automatiquement le contenu des ravitaillements (liquide, solide, chaud,
base vie, assistance) du tableau de course quand l'utilisateur importe une course
**UTMB World Series** par son lien — sans saisie manuelle. Étendre le modèle de
ravito de 3 à 5 catégories.

## Contexte (état actuel)

Import de course (`web/lib/race-import/`) : l'utilisateur colle un lien, deux
chemins (`web/app/api/race-import/route.ts`) :
- **Parser site-spécifique déterministe** via le registre (`sources/index.ts` +
  `findParserForUrl`). Aujourd'hui un seul : `sources/livetrail.ts` (flux XML
  `parcours.php`). Si un parser matche, `parser.parse(url)` renvoie `{ data }`.
  En cas d'échec du parser → fallback LLM automatique.
- **Fallback LLM** (`extract.ts`, gpt-4o) sur le HTML/PDF/image/texte.

Dans les deux cas, `supplies` (contenu ravito) est **toujours laissé vide** (`[]`)
puis saisi à la main via les icônes du tableau (`WaypointsTable.tsx`).

Modèle actuel : `WaypointSupply = 'solid' | 'liquid' | 'base_vie'` (3 catégories,
`web/types/plan.ts`). Colonne DB `race_waypoints.supplies` = `text[] not null
default '{}'` **sans contrainte CHECK** (migration 035).

### Découverte clé (vérifiée empiriquement)

- Le **flux LiveTrail** (`parcours.php`) n'expose **aucun** détail ravito (juste
  km, D+, altitude, barrière, un flag `meet` non discriminant).
- La **page course UTMB** (`{slug}.utmb.world/.../races/{code}`) embarque dans son
  HTML serveur un JSON `"points":[…]` complet. Chaque point contient :
  `distance` (m), `gainElevation`/`lossElevation` (D+/D− cumulés), `name`,
  `cutoff` (ex. `"sam. 07:20"`), `isAssistance` (bool), `supplies`
  (`"none"|"drink"|"food"|"hotFood"`, hiérarchique), `hasBag`, `hasShower`,
  `hasRest`, `isMeet`, etc.

→ Tout le ravito UTMB est extractible **déterministiquement** (zéro LLM), et le
JSON contient même le **D− cumulé** que LiveTrail n'avait pas.

## Approche retenue

**Nouvelle source `sources/utmb.ts`**, jumelle de `livetrail.ts` : parser
déterministe qui lit le JSON embarqué de la page UTMB. (L'alternative « capture
d'écran / PDF du roadbook + LLM + matching par nom » est rejetée : inutile car le
JSON UTMB existe et est structuré.)

## Composants

### 1. Modèle — `WaypointSupply` 3 → 5 (`web/types/plan.ts`)

```ts
export type WaypointSupply =
  | 'liquid' | 'solid' | 'hot' | 'base_vie' | 'assistance'
```

- On **ajoute** `'hot'` (chaud) et `'assistance'`.
- On **garde** `'liquid'`, `'solid'`, `'base_vie'` à l'identique (pas de
  renommage → les `supplies` saisis à la main sur les courses existantes restent
  valides).
- **Aucune migration DB** : `supplies` est `text[]` sans contrainte.

Ordre d'affichage canonique (UI + PDF) : `liquid, solid, hot, base_vie, assistance`.

### 2. Parser `web/lib/race-import/sources/utmb.ts`

`RaceParser` enregistré via `registerParser` (effet de bord à l'import).

**`match(url)`** : `true` si l'hôte se termine par `.utmb.world` **et** le chemin
contient `/races/`. (Évite de matcher la home / pages non-course.)

**`parse(url)`** :
1. `fetch` du HTML (User-Agent navigateur, timeout 10 s, cap 4 Mo — repris de
   livetrail).
2. Extraction du tableau de points : localiser la sous-chaîne `"points":[`, faire
   un **appariement de crochets** `[`/`]` pour isoler le tableau, `JSON.parse`.
   (Le JSON global de la page est volumineux et imbriqué ; on isole juste le
   tableau `points`.)
3. **Mapping** point → waypoint (voir §3) + **filtrage** (voir §4).
4. `validateExtractedRaceData(...)` (réindexe `order_index`, force
   `depart`/`arrivee` aux extrémités, trie par km, vérifie km strictement
   croissants) — réutilisé tel quel depuis `schema.ts`.
5. Renvoie `ExtractedRaceData` (`raceName: null`, `editionYear: null` comme
   livetrail ; le nommage de la course se fait ailleurs).

**Erreurs** : lever `UtmbError` si JSON introuvable / malformé / 0 point. La route
log et **retombe sur le fallback LLM** (comportement existant, l. 67-70 de
`route.ts`) → dégradation gracieuse si UTMB change sa structure.

**Câblage** : `import '@/lib/race-import/sources/utmb'` dans `route.ts` (à côté de
l'import livetrail side-effect).

### 3. Mapping ravito (déterministe)

Pour un point UTMB → `supplies: WaypointSupply[]` :

| Catégorie | Condition |
|---|---|
| `liquid` | `supplies ∈ {drink, food, hotFood}` |
| `solid` | `supplies ∈ {food, hotFood}` |
| `hot` | `supplies === 'hotFood'` |
| `assistance` | `isAssistance === true` |
| `base_vie` | `hasBag === true` |

Autres champs du waypoint :
- `km = distance / 1000`
- `dPlus = gainElevation` ; `dMoins = lossElevation` (cumulés)
- `cutoffRaw = cutoff` (ex. `"sam. 07:20"`) ; `cutoffKind = 'clock_time'` si
  `cutoff` non vide, sinon `null`. (Le préfixe jour `"sam. "` est déjà retiré à
  l'affichage par `barrierClock` / `formatBarrierClock` — cf. travail tableau.)
- `name = name` ; `type = 'ravito'` (réécrit en depart/arrivee par le validate).

Extraite dans une **fonction pure** `mapUtmbPoint(point)` testable isolément.

### 4. Filtrage des points (~13, décision validée)

On ne garde un point que s'il est **utile** :

```
keep = isFirst || isLast
     || supplies !== 'none'      // ravito
     || isAssistance             // assistance
     || cutoff non vide          // barrière horaire
```

Le filtrage s'applique **avant** `validateExtractedRaceData` (qui réindexe).
Résultat attendu sur l'Ultra : 18 points UTMB → ~13 (on retire les landmarks sans
service : Sommet de la Durande, Chapelle de Rochegude, Canyon du Rouchoux, Mont
Devès, Pont de la Roche déviation — sauf s'ils portent une barrière).

### 5. UI tableau — `WaypointsTable.tsx` (affichage auto compact + édition au tap)

Aujourd'hui la cellule Ravito (`.rav-set`) rend **3 boutons-toggles** (54 px). Avec
5 catégories ça ne tient pas sur mobile (360 px) et le contenu est désormais
auto-rempli → on bascule sur **affichage compact + édition au tap** :

- **Cellule** : rend uniquement les catégories **actives**, en petites pastilles
  lettrées colorées dans l'ordre canonique : `L` (liquide, bleu), `S` (solide,
  ambre), `C` (chaud, rouge/orange), `BV` (base vie, vert), `A` (assistance,
  violet/gris). Cellule vide si aucune. La cellule entière est un bouton.
- **Édition** : taper la cellule ouvre un petit sélecteur (popover/bottom-sheet)
  listant les 5 catégories (icône + libellé) en toggles on/off ; changement →
  `update(i, { supplies })`. Édition rare car auto-remplie.
- Icônes : réutiliser `liq`/`sol`/`base` existantes + 2 nouvelles (`hot` =
  flamme, `assistance` = main/personne). Les paths SVG exacts sont définis au
  plan.
- `readOnly` : pas d'ouverture de l'éditeur (affichage seul).

### 6. UI carte PDF — `print/page.tsx` + `print-columns.ts`

- Cas `rav` (l. ~83-89 de `print/page.tsx`) : ajouter les badges `C` (hot) et `A`
  (assistance) après `S`/`L`/`BV`, dans l'ordre canonique. Badges texte courts
  (`.rb`), comme l'existant.
- Légende (l. ~220-227) : ajouter « C chaud » et « A assistance ».
- Poids de la colonne `rav` (`print-columns.ts`, actuellement `1.5`) : vérifier
  qu'il loge jusqu'à 5 badges ; augmenter légèrement si besoin (vérif headless).

## Flux de données

```
URL UTMB collée
  → route.ts (source=url)
  → findParserForUrl(url) == utmbParser
  → utmbParser.parse(url)
      → fetch HTML → extract "points":[…] → map + filter → validate
  → { data: ExtractedRaceData }  (waypoints avec supplies pré-remplis)
  → UI import → enregistrement DB (supplies persistés)
  → tableau Plan + carte PDF affichent les ravitos
```

Si `utmbParser.parse` lève → log + fallback LLM (HTML) → `supplies: []` (comme
aujourd'hui pour les sources non gérées).

## Gestion d'erreurs

- JSON `points` introuvable / non parsable / vide → `UtmbError` → fallback LLM.
- HTML > 4 Mo ou timeout → erreur fetch → fallback LLM.
- Course non-UTMB (lien LiveTrail, autre) → `match` renvoie `false` → chemin
  inchangé, `supplies: []`, saisie manuelle.

## Tests

- `mapUtmbPoint` (pur) : pour chaque valeur de `supplies` (`none/drink/food/
  hotFood`) × `isAssistance` × `hasBag` → tableau `WaypointSupply[]` attendu.
- Filtrage : un jeu de points (dont landmarks `supplies:none` sans cutoff/assist)
  → seuls les utiles + premier/dernier conservés.
- `match()` : `https://saint-jacques.utmb.world/fr/races/100M` → true ;
  `https://saint-jacques.utmb.world/` → false ; `https://livetrail.run/...` →
  false.
- `parse()` sur **fixture HTML** (extrait réel de la page Ultra, tronqué au bloc
  `points`) → 13 waypoints, km/D+/D−/cutoff/supplies corrects sur points clés
  (St Jean Lachalm = liquide+solide+chaud+assistance+base vie).
- Validation : km strictement croissants après filtrage/tri ; depart/arrivee
  forcés.

## Risques / Drift

- **Structure JSON UTMB** : si UTMB renomme `supplies`/`isAssistance`/`hasBag` ou
  change l'embed, le parser lève → fallback LLM (pas de régression dure). Risque
  isolé dans `utmb.ts`, réparable seul. Documenter la dépendance en tête de
  fichier.
- `base_vie ← hasBag` est une heuristique (sac d'allègement = base de vie). Tombe
  juste sur l'Ultra (St Jean Lachalm + arrivée). Ajustable si un cas réel diverge.

## Hors périmètre (futur)

- Auto-remplissage ravito pour les courses **non-UTMB** (nécessiterait LLM sur
  roadbook/capture + matching par nom) — non couvert ici.
- Import des autres services UTMB (douche, WC, bus, médical, Näak) — on ne mappe
  que les 5 catégories demandées.
