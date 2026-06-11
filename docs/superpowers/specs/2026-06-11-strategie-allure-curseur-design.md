# Stratégie d'allure — curseur parlant (courbe live) — Design

**Date :** 2026-06-11
**Statut :** À implémenter

## Objectif

Remplacer le réglage obscur **« Fade 2e moitié » (champ numérique 0→2, caché dans
« Réglages avancés »)** par un **curseur parlant** à la manière du PacePro de Garmin,
posé **au-dessus du tableau de course**, qui :

1. laisse l'athlète choisir la répartition de son effort (**Finir fort ← Régulier →
   Partir vite**) sans manipuler de coefficient ;
2. **montre l'effet en direct** via une courbe d'allure superposée au profil dénivelé,
   et recalcule simultanément les heures de passage du tableau ;
3. **explique la méthode de calcul** des temps intermédiaires en une phrase + un encart
   dépliable, pour ne pas perdre l'athlète.

Maquette validée : `Prompts/pacing-strategy-mockups.html` (variante « Maquette 1 —
Courbe live »), emplacement « au-dessus du tableau ».

## Contexte (existant)

- **Modèle de pacing** : `web/lib/plan/pacing.ts` → `estimatePassageTimes(waypoints,
  { totalDurationSec, fade })` répartit le temps cible sur chaque tronçon au prorata de
  l'**effort-km** (`distance + D+÷100`), modulé par `fade` (centré sur 0.5), avec ancrage
  sur le départ, l'arrivée et les `targetOverrideSec` internes. Le facteur est borné à
  `0.05` → un `fade` **négatif** est déjà supporté sans risque (négatif split).
- **Champ `fade` actuel** : `web/components/plan/RaceEditorModal.tsx` lignes ~290-308,
  `<details>` « Réglages avancés » → un `<input type=number min=0 max=2 step=0.1>` lié à
  `draft.pacingFade`. C'est **le seul champ** de la section avancée.
- **Type** : `Race.pacingFade?: number` (`web/types/plan.ts`).
- **Persistance** : colonne `races.pacing_fade numeric not null default 0`
  (`web/supabase/migrations/035_…sql`) → **pas de CHECK**, le négatif passe →
  **aucune migration**. `saveRace(race)` (`web/lib/plan/storage.ts`) fait un upsert
  complet de la ligne `races`.
- **Page détail course** : `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`.
  - `race` est en state ; barre « Objectif » au-dessus du tableau (lignes ~194-212)
    affiche l'objectif ou la CTA « Définir l'objectif ».
  - `<WaypointsTable … pacingFade={race.pacingFade} />` (lignes ~213-219). La table
    **recalcule déjà** quand `pacingFade` change (`useMemo` deps incluent `pacingFade`).
  - Pattern d'autosave existant : `handleWaypointsChange` met le state à jour puis
    **debounce 600 ms** un `fetch PUT …/waypoints`.

## Design

### 1. Helper pur + test — `web/lib/plan/pacing.ts`

Ajouter une fonction pure pour la courbe :

```ts
// Allure (s/km) de chaque tronçon i (1..n-1), dérivée des temps de passage.
// segmentPaces[0] est toujours 0 (le point 0 = départ, pas de tronçon entrant).
export function segmentPaces(
  waypoints: PacingWaypoint[],
  opts: PacingOptions,
): number[]
```

- Réutilise `estimatePassageTimes` puis `pace[i] = (elapsed[i] − elapsed[i−1]) /
  (km[i] − km[i−1])` ; garde-fou `km` identiques → `0`.
- **Test Jest** `web/__tests__/lib/plan/pacing.test.ts` (créer si absent) :
  - tronçon plus pentu ⇒ s/km plus grand (à fade 0) ;
  - `fade > 0` ⇒ allures de la 2e moitié plus lentes qu'à fade 0 (et l'inverse pour
    `fade < 0`) ;
  - longueur du tableau = `waypoints.length`, `pace[0] === 0`.

### 2. Nouveau composant — `web/components/plan/PacingStrategyCard.tsx` (client)

Props :

```ts
type Props = {
  waypoints: { km: number; dPlus: number | null; targetOverrideSec: number | null }[]
  startTime?: string
  targetDurationMin: number          // requis : la carte n'est rendue que si défini
  pacingFade: number
  onChange: (fade: number) => void
  readOnly?: boolean
}
```

Contenu (réutilise les tokens Deep Mission / classes Tailwind du repo, pas le `<style>`
inline de la maquette) :

- **Titre** « Stratégie d'allure ».
- **Curseur** `<input type=range min=-100 max=100>` :
  - valeur affichée ↔ fade : `fade = (v / 100) × FADE_MAX`, `v = Math.round(fade /
    FADE_MAX × 100)` ; `FADE_MAX = 1.2`.
  - 3 labels d'échelle : **Finir fort** · **Régulier** · **Partir vite**.
  - `onInput` → `onChange(fadeFromSlider(v))` (clampé `[-FADE_MAX, FADE_MAX]`).
  - désactivé si `readOnly`.
- **Phrase dynamique** : `|fade| < 0.08` → « Effort régulier — réparti selon le
  dénivelé. » ; `fade < 0` → « Négatif split — départ prudent pour finir plus vite
  (intensité légère/modérée/marquée). » ; `fade > 0` → « Positif split — tu prends de
  l'avance et tu ralentis sur la fin (…). » (seuils intensité : <40 % / <75 % / sinon).
- **Courbe SVG** : `segmentPaces(waypoints, { totalDurationSec, fade })` pour la ligne
  d'allure (rapide = haut) + aire du profil `dPlus` cumulé. `viewBox` fixe,
  `preserveAspectRatio=none`, axe X « 0 / mi / total km ». Rendu uniquement si ≥ 2
  waypoints exploitables ; sinon on masque la courbe (garde le curseur + phrase).
- **Encart méthode** `<details>` « Comment c'est calculé ? » : `effort = distance +
  D+ ÷ 100` (100 m ≈ 1 km à plat) → répartition au prorata → le curseur incline →
  les heures saisies à la main restent des **ancres**.

Helpers d'affichage (`fadeFromSlider`, `sliderFromFade`, `pacingPhrase`) : locaux au
composant (pas de réutilisation ailleurs → pas dans `lib`).

### 3. Intégration — `CoursePageClient.tsx`

- Insérer `<PacingStrategyCard>` **entre la barre Objectif et `<WaypointsTable>`**,
  rendu seulement si `race.targetDurationMin != null && waypoints.length > 0`.
- `onChange(fade)` :
  1. `setRace(prev => prev ? { ...prev, pacingFade: fade } : prev)` (la carte **et** la
     table reçoivent la nouvelle valeur → recalcul live, aucune requête réseau pour le
     rendu) ;
  2. **debounce 600 ms** un `saveRace({ ...race, pacingFade: fade })` (réf. `useRef`
     timer, même pattern que `handleWaypointsChange`). Pas de reload après save (le state
     est déjà à jour).
- Passer `readOnly` = false (page d'édition).

### 4. Nettoyage — `RaceEditorModal.tsx`

- Retirer le bloc `<details>` « Réglages avancés » + son `<input>` `pacingFade` (lignes
  ~290-308). `pacingFade` reste dans `emptyDraft()` (défaut 0) et dans le `draft`
  sauvegardé tel quel (la modal ne le modifie plus, le curseur s'en charge).
- Vérifier qu'aucune autre logique de la modal ne lit le champ retiré.

### 5. i18n — `web/lib/i18n/dictionaries/fr.ts` + `en.ts`

- **Ajouter** sous `plan` : `pacingTitle`, `pacingScaleStart` (« Finir fort »),
  `pacingScaleMid` (« Régulier »), `pacingScaleEnd` (« Partir vite »),
  `pacingPhraseEven`, `pacingPhraseNeg`, `pacingPhrasePos` (avec placeholder intensité),
  `pacingIntLight/Moderate/Strong`, `pacingMethodSummary`, `pacingMethodBody`,
  `pacingCurveLegendPace`, `pacingCurveLegendElev`.
- **Retirer** `raceEditFieldFade` et `raceEditAdvanced` (devenus inutilisés) du type
  `Dict` et des deux dictionnaires. Vérifier qu'ils ne sont référencés nulle part
  ailleurs avant suppression.

## Hors périmètre (YAGNI)

- Pas de presets nommés (Maquette 2) ni d'impact chiffré tabulaire (Maquette 3).
- Pas de réglage du modèle d'effort-km (le `÷100` reste constant) — c'est le moteur v1.
- Pas de migration DB. Pas de nouvel endpoint (réutilisation de `saveRace`).
- Le curseur n'apparaît pas dans la modal de création (l'objectif s'y définit ; la
  stratégie se règle ensuite sur la page détail, à côté du tableau).

## Plan de vérification

- `npx jest web/__tests__/lib/plan/pacing.test.ts` (vert).
- `tsc` + `eslint` propres (build autoritatif sur Vercel).
- Vérif manuelle : bouger le curseur recalcule courbe **et** colonne Obj du tableau ;
  l'arrivée reste à l'objectif ; rechargement de la page conserve la valeur (save OK) ;
  une heure fixée à la main (override) reste une ancre quand on bouge le curseur.
