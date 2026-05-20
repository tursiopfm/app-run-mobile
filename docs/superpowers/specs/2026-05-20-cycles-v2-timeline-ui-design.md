# Spec — Cycles d'entraînement v2 · Timeline UI (sub-project B)

> **Status: Implémenté** · 2026-05-20 · Code: web/app/(main)/plan/PlanClient.tsx, web/components/plan/{StructurePrepaBlock,MacrocycleSelectorCard,NewMacrocycleModal,RaceMarkers}.tsx, web/lib/training/race-stacking.ts, web/lib/plan/storage.ts
> **Périmètre strict :** UI de visualisation. Aucune édition de mésocycle ou de semaine (réservée à C). Aucun template de prépa (réservé à D). Aucune migration SQL.

## Goal

Livrer la première itération visuelle du module Cycles v2 : afficher proprement les fondations posées en sub-project A (multi-macros, courses A/B/C, focus, loadPattern) sans toucher aux flux d'édition.

Concrètement :
- Un **sélecteur de macrocycle actif** au-dessus du bloc Structure de prépa, scalable à N macros, avec création d'un macrocycle vide.
- Une **timeline horizontale v2** : segments colorés avec leur focus en sous-titre, marqueur today, courses A/B/C affichées sous la timeline avec stacking vertical.
- Un **expand inline read-only** sur chaque segment : vue lecture des semaines (km, D+, charge, weekType) sans champ éditable.

## Problème actuel

Après le sub-project A, le data model supporte multi-macros, priorité races A/B/C, focus, loadPattern et la table `mesocycle_weeks`. Mais l'UI continue de se comporter comme avant :
- `StructurePrepaBlock` lit `getCurrentPlan()` (le plus récent training_plan), sans notion de macro actif sélectionnable.
- Aucune affichage des courses dans la timeline — uniquement un drapeau 🏁 collé à droite pour la course principale.
- Le `focus` ajouté en A est invisible dans l'UI.
- L'utilisateur ne peut pas créer un second macrocycle depuis l'app, ce qui rend les fondations inexploitables en pratique.

## Décisions structurantes (validées en brainstorming)

| # | Décision | Raison |
|---|---|---|
| 1 | Tap segment → expand inline **read-only** (km/D+ en `<span>`, pas `<input>`) | L'édition vit en C ; en B on garde la lecture pour ne pas régresser l'UX |
| 2 | Sélecteur macrocycle = carte + bouton `N macros ▾` (bottom sheet mobile / dropdown desktop) | Scalable à ~10 macros, faible empreinte, cohérent avec le mockup validé |
| 3 | Courses sur timeline : seulement celles dans la fenêtre `[macroStart, macroEnd]`, stacking vertical (priorité A en haut, B/C en bas) | Évite le bruit visuel, hiérarchie claire au premier coup d'œil |
| 4 | Création de macrocycle minimaliste **incluse dans B** (modale 4 champs, sans génération de mésos) | Indispensable pour tester multi-macros ; les templates de prépa attendent D |
| 5 | Macro actif calculé automatiquement (le plus proche temporellement de today) avec override manuel en mémoire React | Pas de localStorage, pas de DB column, simple et suffisant pour V1 |
| 6 | `getCurrentPlan()` reste pour compat (réimpl interne via `pickActiveMacrocycle`) | Les autres blocs (ChargePlanifiee, VueSemaine, ResumeSemaine, CalendrierMois) continuent de marcher sans changement |
| 7 | Zero migration SQL | Toutes les colonnes nécessaires sont déjà en place depuis A |

## Architecture & fichiers

```
web/
  components/plan/
    StructurePrepaBlock.tsx              ← MODIFIED (refonte, props change)
    MacrocycleSelectorCard.tsx           ← NEW
    NewMacrocycleModal.tsx               ← NEW
    RaceMarkers.tsx                      ← NEW (composant pur)
    PlanClient.tsx                       ← MODIFIED (orchestration macro actif + races)
  lib/plan/
    storage.ts                           ← EXTEND (3 nouveaux helpers, getCurrentPlan aligné)
  lib/training/
    race-stacking.ts                     ← NEW (fonction pure computeRaceMarkers)
  __tests__/
    lib/plan/active-macrocycle.test.ts   ← NEW (~6 cas)
    lib/training/race-stacking.test.ts   ← NEW (~7 cas)
```

**Principe d'isolation** : `computeRaceMarkers` et `pickActiveMacrocycle` sont des fonctions pures (entrée → sortie déterministe), sans dépendance React ni Supabase. Les composants `RaceMarkers` et `MacrocycleSelectorCard` reçoivent leurs données en props (pas de fetch interne) pour rester testables et prévisibles.

## Storage (`web/lib/plan/storage.ts`)

### Nouveaux helpers

```ts
// Retourne tous les macrocycles de l'athlète, triés par start_date desc.
// Inclut tous les statuts (planned / active / completed / archived).
// Une seule requête côté Supabase (1 SELECT training_plans + 1 SELECT phases IN plan_ids)
// pour éviter le N+1.
export async function getAllMacrocycles(): Promise<TrainingPlan[]>

// Helper PUR (sans I/O). Choisit le macro 'actif' selon la date :
//   1. Macro avec start <= today <= end (en cours)
//   2. Sinon, macro futur le plus proche (start > today, min start)
//   3. Sinon, macro passé le plus récent (end < today, max end)
//   4. Sinon, null
// Les macros 'archived' sont exclus du calcul sauf si rien d'autre n'existe.
export function pickActiveMacrocycle(
  macros: TrainingPlan[],
  todayISO: string,
): TrainingPlan | null

// Création / update d'un macrocycle. Alias plus explicite de saveCurrentPlan
// pour les futurs sub-projects (D va aussi en avoir besoin pour les templates).
export async function saveMacrocycle(plan: TrainingPlan): Promise<void>
```

### Ajustement `getCurrentPlan`

Réécriture interne pour préserver le comportement legacy :

```ts
export async function getCurrentPlan(): Promise<TrainingPlan | null> {
  const macros = await getAllMacrocycles()
  return pickActiveMacrocycle(macros, new Date().toISOString().slice(0, 10))
}
```

Les blocs existants (`ChargePlanifieeBlock`, `VueSemaineBlock`, `ResumeSemaineBlock`, `CalendrierMoisBlock`) ne changent pas — ils appellent toujours `getCurrentPlan()` et reçoivent le macro actif.

## `MacrocycleSelectorCard.tsx`

Carte fine au-dessus du bloc Structure de prépa.

```tsx
type Props = {
  macros: TrainingPlan[]
  activeMacroId: string | null
  onSelect: (macroId: string) => void
  onCreate: () => void
}
```

**Rendu nominal** :
- Carte avec nom du macro actif + dates (`01 avr → 29 août · 21 sem`) + status pill (`active` / `planned` / `completed` / `archived`).
- Bouton à droite : `N macros ▾` (N = nombre total).

**Bottom sheet / dropdown** (au tap du bouton) :
- Items groupés par statut : `active` en haut, puis `planned`, `completed`, `archived` en bas.
- Item actif coché.
- Bouton `+ Nouveau macrocycle` tout en bas.
- Tap sur un item → `onSelect(id)`, ferme le sheet.

**État vide (0 macros)** : la carte affiche `Aucun macrocycle` + bouton `+ Nouveau macrocycle` direct.

## `NewMacrocycleModal.tsx`

Modale plein écran mobile / centrée desktop.

```tsx
type Props = {
  open: boolean
  onClose: () => void
  onCreated: (newMacroId: string) => void
  races: Race[]
}
```

**Champs** :
1. **Nom** (text, requis) — placeholder `"Prépa UTMB 2026"`. Si vide à la save, fallback `"Macrocycle <ISO date>"`.
2. **Date de début** (date input, requis). Default = aujourd'hui.
3. **Date de fin** (date input, requis). Default = +12 semaines. Validation : `end > start` strictement.
4. **Course objectif** (select, optionnel) — liste des courses futures (`race.date >= today`), plus option `Aucune`.

**À la sauvegarde** :
- Construire un `TrainingPlan` minimal : `phases: []`, `status: today >= startDate && today <= endDate ? 'active' : 'planned'`, `templateId: undefined` (D introduira les templates), `goalRaceId` depuis le select.
- Appeler `saveMacrocycle(plan)`.
- `onCreated(plan.id)` → le parent switche `activeMacroOverrideId` sur ce nouveau macro et bumpe `reloadKey`.
- Toast léger : `"Macrocycle créé. Ajoute des mésocycles depuis Structure de prépa."`.

**Pas de génération de mésocycles** dans cette modale (D s'en chargera).

## `StructurePrepaBlock.tsx` (refonte)

Props change pour devenir un composant **piloté par le parent** :

```tsx
type Props = {
  activeMacrocycle: TrainingPlan | null
  races: Race[]
  onChange?: () => void
  reloadKey?: number
}
```

Le composant ne fait plus `getCurrentPlan()` lui-même.

**Rendu** (mobile-first, ~360px de largeur cible) :

1. **Header** : titre `Structure de prépa` + status pill du macro + bouton `✎ éditer` (ouvre `PhaseEditorModal` existant — sera étendu en C).

2. **Timeline horizontale** : barre 48px de haut, segments avec `flex` proportionnel au nombre de semaines.
   - Couleur : `PHASE_DEFINITIONS[phase.type].color`.
   - Label : nom court de la phase (depuis `phase.label`) + `focus` en sous-titre (depuis `phase.focus`), masqué si `weeks / totalWeeks < 0.12`.
   - Marqueur today : trait vertical blanc 3px avec `box-shadow` (caché si today hors-range).
   - Tap → toggle `expandedId`.

3. **Tick row** : dates de début sous chaque segment (format `JJ/MM`).

4. **`<RaceMarkers />`** : rangée(s) sous la timeline pour les courses A/B/C in-window.

5. **Expand inline read-only** (si `expandedId`) :
   - Header : pastille couleur + nom phase + focus + chip `loadPattern`.
   - Description si présente.
   - Stats : `Début → Fin`, `Durée`, `Charge cible TSS/sem`.
   - **Tableau hebdo READ-ONLY** : 1 ligne par semaine, colonnes `Sem N`, `Date`, `Type` (chip weekType), `Volume km`, `D+ m`, `Charge TSS`. Valeurs en `<span>`, pas d'input. Chip ✎ orange si `is_manual_override`.
   - Bouton `Éditer ce cycle` (ouvre `PhaseEditorModal`, fonctionne en lecture seule pour les nouveaux champs en attendant C).

**Source des données du tableau hebdo** : `getPhaseWeeks(phase)` existant (lit JSONB legacy + défauts). Plus tard en C on basculera sur `getWeeksForPhase(phase.id)` (table `mesocycle_weeks`).

**États vides** :
- `activeMacrocycle === null` → empty state avec CTA `+ Nouveau macrocycle` (qui ouvre la modale via le parent).
- `activeMacrocycle.phases.length === 0` → CTA `Générer ma structure de prépa` (logique existante `autoDistributePhases`).

## `RaceMarkers.tsx`

Composant pur qui rend les markers de courses.

```tsx
type Props = {
  races: Race[]
  macroStart: string
  macroEnd: string
}

export function RaceMarkers({ races, macroStart, macroEnd }: Props)
```

Délègue le calcul à `computeRaceMarkers` (`web/lib/training/race-stacking.ts`) puis rend chaque marker.

**Rendu visuel par priorité** :
- **A** : drapeau orange `bg-trail-primary`, glow `box-shadow: 0 0 8px rgba(249,115,22,0.5)`, 28×28px, nom + `A · JJ/MM`.
- **B** : drapeau jaune `bg-trail-yellow`, 20×20px, nom + `B · JJ/MM`.
- **C** : point gris 10×10px, nom court + `C · JJ/MM`.

**Tap sur un marker** : ouvre un drawer (mobile) / popover (desktop) avec détails de la course (nom, distance, D+, date, priorité, lien vers `/plan/courses/[id]`).

## Race stacking (`web/lib/training/race-stacking.ts`)

Fonction pure exportée pour tests.

```ts
export type RaceMarker = {
  race: Race
  leftPercent: number   // position horizontale (0..100)
  lane: number          // 0 = A en haut, 1 = B/C, 2+ = lanes fantômes si collision
}

export function computeRaceMarkers(
  races: Race[],
  macroStart: string,
  macroEnd: string,
): RaceMarker[]
```

**Algorithme** :

1. Filtrer : ne garder que `race.date >= macroStart && race.date <= macroEnd`.
2. Pour chaque race retenue : `leftPercent = ((race.date - macroStart) / (macroEnd - macroStart)) * 100`.
3. Lane assignment initiale :
   - `priority === 'A'` → `lane: 0`
   - `priority === 'B' || 'C'` → `lane: 1`
4. Détection collisions intra-lane (parcours en croissant de `leftPercent`) : si la course courante est à `< 8%` du dernier marker dans la même lane, on la pousse dans une lane fantôme (`lane + 1`). Si la lane fantôme est aussi occupée, on incrémente jusqu'à trouver libre. Max lane utilisée capée à 3 (au-delà : log warn + on accepte la collision visuelle — cas extrême non bloquant).

## `PlanClient.tsx` (orchestration)

State ajouté :

```tsx
const [macros, setMacros] = useState<TrainingPlan[]>([])
const [races, setRaces] = useState<Race[]>([])
const [activeMacroOverrideId, setActiveMacroOverrideId] = useState<string | null>(null)
const [newMacroModalOpen, setNewMacroModalOpen] = useState(false)
const [reloadKey, setReloadKey] = useState(0)

const activeMacrocycle = useMemo(() => {
  if (activeMacroOverrideId) {
    return macros.find(m => m.id === activeMacroOverrideId) ?? null
  }
  return pickActiveMacrocycle(macros, new Date().toISOString().slice(0, 10))
}, [macros, activeMacroOverrideId])
```

Au mount : `Promise.all([getAllMacrocycles(), getRaces()])`. `reloadKey` bumpé après chaque save → re-fetch.

Layout dans le JSX :
- `<ObjectifCourseBlock />` (existant, inchangé)
- `<MacrocycleSelectorCard />` (nouveau)
- `<StructurePrepaBlock activeMacrocycle={...} races={...} />` (refonte)
- … autres blocs existants …
- `<NewMacrocycleModal open={...} onCreated={(id) => { setActiveMacroOverrideId(id); setReloadKey(k => k + 1); setNewMacroModalOpen(false) }} />`

## Tests

### `__tests__/lib/plan/active-macrocycle.test.ts` (~6 cas)

- `pickActiveMacrocycle([], '2026-05-20')` → `null`.
- 1 macro avec `start <= today <= end` → ce macro.
- Today avant tous les macros (3 macros futurs) → le macro avec `start` minimum.
- Today après tous les macros (3 macros passés) → le macro avec `end` maximum.
- Mix `active` + `planned` + `archived`, today dans la fenêtre de `archived` mais aussi `active` → l'`active`.
- Mix tous `archived` → le `archived` le plus récent (fallback ultime).

### `__tests__/lib/training/race-stacking.test.ts` (~7 cas)

- `computeRaceMarkers([], '2026-04-01', '2026-08-29')` → `[]`.
- 1 race A à 50% → `{ leftPercent: 50, lane: 0 }`.
- 1 race avant macroStart → filtrée, absente.
- 1 race après macroEnd → filtrée, absente.
- 2 races A à 50% et 95% → lanes 0 et 0 (distance > 8%).
- 2 races A à 50% et 53% → lanes 0 et 2 (collision, A va en fantôme).
- Mix 1 A + 2 B + 1 C → A en lane 0, B/C en lane 1, ordre chronologique par `leftPercent`.

### Pas de tests UI / e2e

Smoke test manuel : ouvrir `/plan`, vérifier la carte sélecteur, créer un 2ème macro, switcher, vérifier que les autres blocs (Charge planifiée, Vue semaine) restent cohérents avec le macro actif.

## Compat & rollout

- `getCurrentPlan()` est aligné sur `pickActiveMacrocycle` → comportement identique pour les consommateurs existants.
- Le `training_plan` legacy existant a `status: 'active'` (depuis A) → devient automatiquement le macro actif au mount.
- Pas de migration SQL.
- Pas de feature flag — changement cosmétique sur un seul onglet.
- Rollback = revert du commit Git, la DB n'est pas touchée.

## Hors scope (renvoyé à C / D)

- **Édition des mésocycles** (changer type, focus, loadPattern, dates) → C.
- **Édition des semaines** (override km / D+ / weekType / comment) → C.
- **Suppression de macrocycle** → C (le bouton existe peut-être déjà dans `PhaseEditorModal`, à vérifier ; pour l'instant on garde le comportement existant).
- **Archivage manuel** d'un macrocycle (`status: 'archived'`) → C (peut être un menu kebab dans le sélecteur, mais YAGNI V1).
- **Templates de prépa** (ultra / trail court / reprise) → D.
- **Génération automatique de mésos** depuis un template lors de la création → D.
- **Warnings pédagogiques** (taper manquant avant A, montée brutale) → C.
- **Page séparée `/plan/cycles`** → pas prévu (decision: le sélecteur in-page suffit).

## Critères d'acceptation

- `npm run build` passe sans warning TS.
- `npm test` → tous les tests passent dont les ~13 nouveaux.
- `npm run lint` → clean.
- Sur `localhost:3000/plan` :
  - La carte `MacrocycleSelectorCard` apparaît avec le training_plan existant comme macro actif.
  - La timeline affiche les segments avec leur focus en sous-titre (si renseigné), sinon juste le nom.
  - Les courses A/B/C de la liste Objectif course apparaissent sous la timeline aux bonnes positions, avec le bon visuel par priorité.
  - Tap segment → expand read-only fonctionne, tableau hebdo s'affiche en lecture seule.
  - Clic `+ Nouveau macrocycle` → modale s'ouvre, création OK, switch automatique sur le nouveau macro.
  - Les autres blocs (Charge planifiée, Vue semaine, Calendrier mois) continuent de fonctionner avec le macro actif (ils consomment `getCurrentPlan()` qui pointe désormais sur l'actif).
- Une course principale (priorité A) dans la fenêtre du macro est rendue avec drapeau orange + glow.
- Une course hors-fenêtre n'apparaît PAS sur la timeline (cohérent avec la décision validée).
