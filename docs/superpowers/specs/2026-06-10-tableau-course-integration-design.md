# Intégration du tableau de course + export PDF — Design

> Statut : Validé (brainstorming) · 2026-06-10
> Maquettes source : `Prompts/tableau-course-mockup-optionA.html` (écran), `Prompts/tableau-course-pdf-mockup.html` (carte/impression)

## Contexte

La page course (`web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`) affiche aujourd'hui les
points de passage via `WaypointsTable` en **lecture seule** (« édition phase 1 = uniquement par
ré-import »). Le modèle `RaceWaypoint` ne porte ni le **type de ravito** (solide/liquide/base vie)
ni l'**objectif de temps** par point. Les maquettes validées introduisent ces deux notions, des
colonnes recalculées (Inter, Σ D+), et un export PDF imprimable « à lire en course ».

## Objectifs

1. Rendre le tableau **éditable inline** (geometry + ravitos + objectif), avec colonnes auto-calculées.
2. Ajouter le **type de ravito** (solide / liquide / base vie), éditable et persisté.
3. Calculer l'**heure de passage visée** par point (auto, ajustable) via un module de pacing isolé.
4. Fournir un **export PDF A4 paginé** (impression navigateur), lisible quel que soit le nombre de points.

## Non-objectifs (→ `tasks/backlog.md`)

- Moteur d'estimation avancé : VAP grade-adjusted réel + calibration sur indice UTMB/Betrail de
  l'athlète + benchmark sur les résultats historiques des autres coureurs. **Phase suivante.**
- Le « Profil dénivelé » de la page course reste son placeholder actuel.

## 1. Modèle de données — migration `035`

> ⚠️ Migrations Supabase **non auto-appliquées** : rappeler à Franck de coller le SQL dans le
> dashboard (ou `supabase db push`). Ne pas annoncer le schéma comme « live » tant que ce n'est pas fait.

**`race_waypoints`** (créée en 025) — 2 colonnes :

| Colonne | Type | Défaut | Rôle |
|---|---|---|---|
| `supplies` | `text[]` | `'{}'` | Sous-ensemble de `{solid, liquid, base_vie}` — contenu du ravito, coché par l'athlète |
| `target_override_sec` | `int` | `null` | Correction manuelle d'une heure de passage, en **secondes écoulées depuis le départ**. Non nul ⇒ point figé (ancre) |

**`races`** — 3 colonnes :

| Colonne | Type | Défaut | Rôle |
|---|---|---|---|
| `start_time` | `time` | `null` | Heure de départ (combinée à `date` existante) |
| `target_duration_min` | `int` | `null` | Temps cible total (ex. 37 h ⇒ 2220) |
| `pacing_fade` | `numeric` | `0` | Coefficient « 2ᵉ moitié plus lente » (0 = neutre) |

Types TS (`web/types/plan.ts`) : étendre `RaceWaypoint` (`supplies: WaypointSupply[]`,
`targetOverrideSec: number | null`) et `Race` (`startTime`, `targetDurationMin`, `pacingFade`).
`WaypointSupply = 'solid' | 'liquid' | 'base_vie'`.

### Sémantique `dPlus` / `dMoins` (canonique = **cumulé**)

`km` est déjà cumulé. Le parser LiveTrail (`@_d`) fournit le **D+ cumulé** au point ; les roadbooks
trail affichent eux aussi le D+ cumulé. On fixe donc la convention : **`dPlus` / `dMoins` stockés =
cumulés depuis le départ** (pas de nouvelle colonne). En conséquence :
- `Σ D+` (colonne du tableau) = `dPlus` directement (valeur stockée) ;
- `▲ D+` (D+ du tronçon) = **dérivé** : `dPlus_i − dPlus_{i-1}` (idem `▼ D−`) ;
- le pacing consomme le D+ de tronçon dérivé (cf. §2).

Clarifier le prompt d'extraction (`web/lib/race-import/prompt.ts`) : préciser que `d_plus`/`d_moins`
sont le **dénivelé cumulé** au point (cohérent avec LiveTrail). Les courses déjà importées avec une
autre interprétation se corrigent par ré-import — pas de backfill (volume faible, données par athlète).

## 2. Module pacing — `web/lib/plan/pacing.ts` (pur, testé, pluggable)

Fonction pure, **sans dépendance UI** :

```ts
estimatePassageTimes(
  waypoints: { km: number; dPlus: number | null; targetOverrideSec: number | null }[],
  opts: { totalDurationSec: number; fade: number },
): number[]   // secondes écoulées depuis le départ, une valeur par point (point 0 = 0)
```

**Algorithme v1 :**

1. **Effort-km** par tronçon `i` (du point `i-1` au point `i`) :
   `effortKm_i = distance_i + (dPlusSegment_i / 100)` où `distance_i = km_i − km_{i-1}` et
   `dPlusSegment_i = max(0, dPlus_i − dPlus_{i-1})` (le `dPlus` stocké est **cumulé**, cf. §1 ;
   D+ manquant ⇒ 0). 100 m de D+ ≈ 1 km plat (la pente moyenne se déduit de `dPlusSegment/distance`).
2. **Fade** : poids temps `w_i = effortKm_i × (1 + fade × (progress_i − 0.5))`, où
   `progress_i` = fraction d'effort-km cumulé au milieu du tronçon (0→1). `fade = 0` ⇒ pure
   répartition effort. Le facteur est centré sur 0.5 pour que le total reste ≈ cible.
3. **Ancres + recalcul de la suite** : on découpe la route par ancres = {départ (0), points avec
   `targetOverrideSec`, arrivée (totalDurationSec)}. Dans chaque intervalle entre 2 ancres, le temps
   disponible (`ancreFin − ancreDébut`) est réparti au prorata des `w_i` des tronçons de l'intervalle.
   ⇒ corriger une heure décale et redécoupe automatiquement les tronçons suivants.

**Couture v2** : seuls le calcul du poids `w_i` et la dérivation du `totalDurationSec` (depuis indice
UTMB/Betrail + historique) changeront. La signature et les consommateurs (table, PDF) restent intacts.

**Tests Jest** (`web/__tests__/lib/plan/pacing.test.ts`) :
- somme des durées de tronçon = `totalDurationSec` ;
- suite strictement croissante ;
- `fade > 0` ⇒ 2ᵉ moitié plus lente (pace/effort-km supérieur) ;
- override au point k ⇒ k vaut exactement l'override, et les points entre k et l'ancre suivante sont
  redistribués (les points avant k inchangés).

## 3. Tableau écran — refonte `web/components/plan/WaypointsTable.tsx`

Colonnes (Option A) : `✓ · Point · Km · ΣD+ · Inter · ▲D+ · ▼D− · Ravito · Objectif · Barrière`.

- **Calculées (lecture seule)** : `Inter = km_i − km_{i-1}` ; `▲D+ = dPlus_i − dPlus_{i-1}`,
  `▼D− = dMoins_i − dMoins_{i-1}` (tronçon, dérivés du cumulé). Recalculées au vol (jamais persistées).
- **Éditables** : `Point` (texte), `Km` (number, cumulé), `ΣD+` / `ΣD−` (number, **cumulés** = source de
  vérité ; le tronçon ▲/▼ se met à jour en dérivé, pas de cascade), `Ravito` (toggles S / L / BV),
  `Objectif` (heure visée), `Barrière` (`cutoffRaw` + `cutoffKind`).
- **Objectif** : affiche l'heure calculée (`départ + estimatePassageTimes`). L'éditer (saisie `HH:MM`)
  convertit en `targetOverrideSec` et déclenche le recalcul. Si `start_time` ou `target_duration_min`
  absents ⇒ colonne affiche `—` (le reste du tableau fonctionne).
- `✓` : case à cocher purement visuelle d'aide à l'impression (pas persistée).

Persistance : on retire `readOnly` dans `CoursePageClient`, `onChange` appelle le **PUT existant**
(`/api/races/[id]/waypoints`, stratégie delete+insert) **debounced**. Étendre le mapping
(`lib/race-import/schema.ts` `rowToRaceWaypoint` + sérialisation du PUT) pour `supplies` et
`target_override_sec`.

## 4. Saisie course — `web/components/plan/RaceEditorModal.tsx`

Ajouter 3 champs : **Heure de départ** (`start_time`), **Temps cible** (`hh:mm` ⇒ `target_duration_min`),
**Fade** (number/slider, replié sous « Réglages avancés »). Alimentent le pacing. Persistés via la voie
de mise à jour course existante (`lib/plan/storage` / route course).

## 5. Export PDF — `web/app/(main)/plan/courses/[id]/print/page.tsx` (nouveau)

- Server component : fetch course + waypoints, calcule les heures (même module pacing), rend un
  **tableau A4 paysage** stylé d'après `Prompts/tableau-course-pdf-mockup.html` adapté à A4 :
  fond blanc, gros caractères, `thead` répété par page (`@media print`), légende en fin, pagination
  automatique pour N quelconque.
- Bouton **« Exporter en PDF »** sur `CoursePageClient` → ouvre `/plan/courses/[id]/print` ;
  `window.print()` au chargement + bouton « Imprimer / Enregistrer en PDF » de secours.
- Vérification du rendu via Chrome headless Windows (cf. `tasks/lessons.md` 2026-06-10) avant de
  conclure.

## Fichiers touchés

- `web/supabase/migrations/035_*.sql` (nouveau)
- `web/types/plan.ts`
- `web/lib/plan/pacing.ts` (nouveau) + `web/__tests__/lib/plan/pacing.test.ts` (nouveau)
- `web/lib/race-import/schema.ts` (`rowToRaceWaypoint` + mapping)
- `web/lib/race-import/prompt.ts` (préciser `d_plus`/`d_moins` = cumulé)
- `web/app/api/races/[id]/waypoints/route.ts` (PUT : `supplies`, `target_override_sec`)
- voie de mise à jour `races` (`web/lib/plan/storage.ts` et/ou route course) pour les 3 champs course
- `web/components/plan/WaypointsTable.tsx` (refonte)
- `web/components/plan/RaceEditorModal.tsx` (3 champs)
- `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` (édition + bouton export)
- `web/app/(main)/plan/courses/[id]/print/page.tsx` (nouveau)
- `tasks/backlog.md` (moteur d'estimation avancé)

## Stratégie de test / vérification

- Unitaires Jest : `pacing.ts` (cf. §2), mapping `rowToRaceWaypoint` avec nouveaux champs.
- Vérif manuelle : importer une course → éditer geometry/ravitos → renseigner départ+temps cible →
  vérifier Objectif auto + recalcul après override → export PDF (rendu headless).
- Build autoritatif sur Vercel (le `next build` local est bloqué si un `next dev` tourne).

## Décisions actées (brainstorming)

- Objectif = **auto puis ajustable** ; édition manuelle = **recalcule la suite**.
- Ravitos = **nouveau champ éditable persisté** (migration).
- PDF = **vue d'impression + `window.print()`**, format **A4 paginé**.
- Pacing v1 = **VAP simplifié (effort-km) + fade**, derrière interface pluggable ; moteur avancé
  (indice UTMB/Betrail + historique) = **phase suivante** (backlog).
