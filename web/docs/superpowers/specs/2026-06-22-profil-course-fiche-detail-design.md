# Profil de course — fiche détail + puces ravito + sélection unifiée (mode dense)

**Date :** 2026-06-22
**Statut :** Spec validée — à implémenter
**Maquette de référence :** `Prompts/profil-course-mockup-D-hybride.html` (rendu validé par Franck)

## Contexte & objectif

Le profil de course (onglet Plan → page course) affiche aujourd'hui, en **mode dense**
(trace GPX attachée), une courbe d'altitude réelle avec des marqueurs ravitos et un
highlight croisé au survol entre le graphe et le tableau de course. On enrichit ce mode
dense pour s'approcher du rendu UTMB officiel :

1. **Puces ravito** au-dessus des points du graphe (les mêmes L/S/C/BV/A que le tableau).
2. **Fiche détail** sous le graphe, montrant le ravitaillement sélectionné.
3. **Sélection unifiée** graphe ↔ tableau (taper l'un sélectionne l'autre).

Tout reste **dérivé des waypoints existants** (`race_waypoints`) : aucune donnée dupliquée.
Quand Franck édite le tableau (ravitos, barrières, objectif), le profil se met à jour.

## Décisions validées

| Sujet | Décision |
|---|---|
| Interaction | Fiche **permanente**, sélection **unifiée** graphe ↔ tableau, défaut = **1er ravito**, navigation **‹ ›** dans la fiche. |
| Périmètre | **Mode dense uniquement** (trace GPX). Le mode escalier (sans trace) reste inchangé. |
| Passage estimé | **Inclus** en v1, en réutilisant le moteur d'heures (`estimatePassageTimes` + objectif de la course). |
| Couleur d'accent | Orange de charte `chargeOrange = #FF7900` (déjà la valeur utilisée par le composant). |

## Logique d'affichage des puces

Les 5 catégories (`WaypointSupply`) et leur rendu reprennent **exactement** le tableau
(`SUPPLY_CAT` dans `WaypointsTable.tsx`) : `liquid`→**L** (bleu), `solid`→**S** (jaune),
`hot`→**C** (rouge), `base_vie`→**BV** (vert), `assistance`→**A** (violet `#7C5CFC`).

Deux vues distinctes de la même donnée :

- **Graphe — vue réduite** (hiérarchie implicite, pour désencombrer) : une seule puce
  « nourriture » = le niveau le plus haut présent, car `hot ⊃ solid ⊃ liquid` :
  - `hot` présent → **C** (ni S ni L)
  - sinon `solid` présent → **S** (pas L)
  - sinon `liquid` présent → **L**

  puis **+ BV** si `base_vie`, **+ A** si `assistance`. Max 3 puces (ex. `C`+`BV`+`A`).
- **Fiche détail — vue complète** : **toutes** les puces du waypoint, dans l'ordre canonique
  `liquid, solid, hot, base_vie, assistance`.

Sur le graphe, les puces d'un point sont **empilées verticalement** (largeur minimale →
pas de chevauchement horizontal aux ravitos proches), ordre de bas en haut :
**nourriture en haut**, puis BV, puis A près du point (ordre inversé de la liste canonique).

## Architecture & data flow

`CoursePageClient` (client) reste l'orchestrateur. Il détient déjà `waypoints`,
`track` (trace dense), `hoveredWaypointIndex`. On ajoute :

- **état `selectedWaypointIndex: number`** — source unique de la sélection ; défaut = index
  du 1er waypoint de type `ravito` (fallback : index 1, ou 0 si une seule ligne).
- **calcul des heures de passage** (mémoïsé) via `estimatePassageTimes(waypoints,
  { totalDurationSec, fade })` avec `totalDurationSec = race.targetDurationMin * 60`
  et `fade = race.pacingFade ?? 0`. Si `targetDurationMin` est absent, on ne calcule pas
  les heures (la fiche affiche « — » pour le passage estimé) — pas de valeur par défaut inventée.

Ces données descendent en props vers le tableau, le graphe et la fiche. La sélection
remonte via callbacks. Le `hoveredWaypointIndex` existant (highlight croisé au survol,
desktop) **reste tel quel** ; la sélection s'y superpose et **prime visuellement** (point
sélectionné en orange).

```
CoursePageClient
  ├─ waypoints, track, passages[]  ───────────────┐
  ├─ selectedWaypointIndex (état) ──┬─────────────┤
  │                                 │             │
  ├─► WaypointsTable        ◄───────┤  (tap ligne → onSelectIndex)
  ├─► ElevationProfileChart ◄───────┤  (tap point → onSelectIndex ; puces ; orange)
  └─► WaypointDetailCard    ◄───────┘  (‹ › → onSelectIndex±1 ; passage estimé ; puces)
```

## Composants & fichiers

### `lib/plan/supply-chips.ts` *(nouveau — pur, testé)*
Source unique de la logique puces, partagée graphe / fiche / légende.
- `SUPPLY_META: Record<WaypointSupply, { letter: string; label: string; color: string }>`
  — `color` = valeurs `light` de `lib/design/colors.ts` (`light.seriesBlue` #1D8FC6,
  `light.seriesYellow` #CC9200, `light.seriesRed` #D94F45, `light.greenOk` #138A52)
  + `#7C5CFC` pour `assistance` : identiques aux puces du tableau, texte blanc lisible
  sur fond clair.
- `chartChips(supplies: WaypointSupply[]): WaypointSupply[]` — vue réduite (règle ci-dessus).
- `allChips(supplies: WaypointSupply[]): WaypointSupply[]` — ordre canonique filtré.

### `lib/plan/passage-clock.ts` *(nouveau — pur, testé)*
Heure de passage absolue par waypoint.
- `passageClocks(waypoints, opts: { startTime?: string; totalDurationSec: number; fade: number; startDateIso?: string | null }): string[]`
  — réutilise `estimatePassageTimes` pour l'elapsed, ajoute `startTime` ('HH:MM'),
  formate `HH:MM` ; préfixe le jour relatif si la course passe minuit
  (« J », « J+1 »… ou jour de semaine court « mar. »/« mer. » si `startDateIso` connu).
  Retourne `''` pour un waypoint sans donnée exploitable (objectif/heure manquants).

### `components/plan/WaypointDetailCard.tsx` *(nouveau)*
La fiche permanente sous le graphe. Props : le waypoint sélectionné, le précédent, son
altitude (interpolée sur la trace), son heure de passage, callbacks `onPrev`/`onNext`
(bornés), bornes `hasPrev`/`hasNext`.
- En-tête : **toutes** les puces (`allChips`) + nom + tag « Base vie » (si `base_vie`) +
  boutons ‹ ›.
- Grille : **Distance** (`km`), **Altitude** (m, interpolée trace), **Depuis {nom
  précédent}** (`+D+ · −D−`, différence des cumuls), **Passage estimé** (heure absolue),
  **Barrière horaire** (`cutoffRaw` formaté, sinon « — »), **Ravitaillement** (libellés
  longs des puces, ou « — » si aucun).
- Accent orange `#FF7900` (fond dégradé chaud + valeur barrière).

### `components/plan/ElevationProfileChart.tsx` *(modifié — branche dense)*
- `ProfileWaypoint` gagne `supplies: WaypointSupply[]` et `cutoffRaw: string | null`.
- Nouvelles props : `selectedIndex: number | null`, `onSelectIndex: (i: number) => void`.
- Pour chaque marqueur ravito : connecteur fin + **colonne de puces empilées** (`chartChips`,
  nourriture en haut). Décalage vertical d'un cran si le ravito précédent est à < ~6 km
  (anti-chevauchement).
- Le point `selectedIndex` est rendu en **orange `chargeOrange`** (gros point + connecteur
  + petite étiquette km) et prime sur le hover. Tap sur un point → `onSelectIndex`.
- Hors mode dense (escalier) : props sélection/puces ignorées, rendu inchangé.

### `components/plan/WaypointsTable.tsx` *(modifié)*
- Props `selectedIndex?: number | null`, `onSelectIndex?: (i: number) => void`.
- Tap sur une ligne (zone nom/point, hors boutons d'édition existants) → `onSelectIndex`.
- Style de la ligne sélectionnée (distinct du highlight de survol `hl`).

### `app/(main)/plan/courses/[id]/CoursePageClient.tsx` *(modifié)*
- État `selectedWaypointIndex` + initialisation au 1er ravito quand les waypoints chargent.
- `passages` mémoïsé. Câblage des nouvelles props vers tableau / graphe ; rendu de
  `WaypointDetailCard` sous le graphe **uniquement en mode dense** (`track` présent).

## Périmètre & non-objectifs

- **Dans le périmètre** : mode dense uniquement ; puces réduites (graphe) / complètes
  (fiche) ; sélection unifiée ; passage estimé ; barrière + D+/D− depuis le précédent.
- **Hors périmètre** : mode escalier inchangé (pas de fiche/puces/sélection sans trace) ;
  pas d'édition depuis la fiche (lecture seule) ; pas de recalcul du D+/D− officiel ;
  pas de refacto des puces du tableau (il garde son rendu actuel, visuellement aligné).

## Tests

- `supply-chips.test.ts` — `chartChips` : `[liquid]→[L]`, `[liquid,solid]→[S]`,
  `[liquid,solid,hot]→[C]`, `+base_vie`/`+assistance` ajoutés et ordonnés ; `allChips`
  conserve l'ordre canonique complet.
- `passage-clock.test.ts` — elapsed→heure absolue depuis `startTime` ; passage minuit
  (J+1) ; objectif/heure manquants → `''`.
- `ElevationProfileChart.dense.test.tsx` — puces réduites rendues au bon point ; point
  sélectionné en orange ; tap point appelle `onSelectIndex` ; escalier inchangé.
- `WaypointDetailCard.test.tsx` — champs affichés, toutes les puces, nav bornée
  (pas de prev sur le 1er, pas de next sur le dernier), « — » quand barrière/ravito absents.
- `WaypointsTable.*.test.tsx` — tap ligne → `onSelectIndex(i)` ; ligne sélectionnée stylée.

## Risques & notes

- **Passage estimé** : dépend de l'objectif (`targetDurationMin`) et de l'heure de départ
  (`startTime`) ; si absents, le champ affiche « — » sans casser le reste. Le jour de
  semaine n'est affiché que si la date d'édition est connue, sinon « J+1 ».
- **Cohérence couleurs** : les puces utilisent les valeurs `light` de `colors.ts`
  (identiques aux puces du tableau, texte blanc lisible) ; en thème sombre, léger écart
  avec la courbe (`colors.seriesBlue` fixe), à surveiller en revue.
- **Densité** : le décalage vertical gère les paires proches ; au-delà de ~3 ravitos en
  4-5 km, un léger empiètement reste possible (acceptable, à réévaluer si gênant).
