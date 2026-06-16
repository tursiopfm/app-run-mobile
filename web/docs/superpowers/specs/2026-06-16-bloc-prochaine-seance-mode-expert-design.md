# Bloc « Ta prochaine séance » dans le mode expert (onglet Plan)

> Statut : design validé · 2026-06-16 · Auteur : Franck + Claude

## Contexte

Le bloc héros « Ta prochaine séance » (`PlanHeroCard`) n'existe aujourd'hui que
dans le **mode simplifié** (mission), où il est rendu et piloté par
`components/mission/MissionPlan.tsx`. Le **mode expert** de l'onglet Plan
(`app/(main)/plan/PlanClient.tsx`) affiche une liste de blocs `BlockGrid`
déplaçables et masquables, mais ne propose pas ce bloc.

Objectif : exposer le **même** bloc (périmètre identique à la maquette : titre +
profil graphique + cible FC + « Pourquoi cette séance » + curseur « Selon ta
forme du jour » + accès Bibliothèque + modales d'ajout/édition) dans le mode
expert, comme un bloc `BlockGrid` à part entière :

- **déplaçable** (poignée fournie automatiquement par `BlockGrid`) ;
- **masquable** via le kebab `⋮` → « Masquer » (comme les autres blocs) ;
- **visible par défaut, en première position** (`DEFAULT_ORDER`). Note : pour
  les utilisateurs ayant déjà un ordre enregistré, `BlockGrid` ajoute les
  nouveaux ids en **fin** de liste — ils le retrouveront donc en bas et pourront
  le remonter. Comportement standard de tous les nouveaux blocs.

## Problème d'architecture

La logique qui produit les props de `PlanHeroCard` (~150 lignes : fetch des
séances/macros/course, curseur persisté, moteur `adviseWeek`/`applySlider`,
détection « séance faite », modales) vit **dans** `MissionPlan.tsx` et y est
couplée au fil « Ma semaine » (le curseur produit une séance virtuelle du jour
qui ré-alimente le fil).

Décision (Approche A — extraction propre) : sortir cette logique dans un **hook
partagé** consommé par `MissionPlan` **et** par le nouveau bloc expert. Une
seule source de vérité pour le moteur ; le fil « Ma semaine » reste spécifique à
MissionPlan.

Le couplage curseur ↔ fil est préservé en calculant tout **en render** (pas de
`useEffect` de synchronisation) : l'état du curseur vit dans le hook, donc une
modification ré-exécute le hook puis MissionPlan de façon synchrone, sans
décalage d'une frame ni boucle d'effet.

## Composants

### 1. `components/mission/useTodaySession.ts` (NOUVEAU) — hook partagé

```ts
useTodaySession({
  freshnessPayload,   // ChargeSportPayload | null
  recentActivities,   // ActivityRow[] (28 j)
  hrZones,            // HrZone[]
  reloadKey?,         // number — bump externe (PlanClient) → re-fetch
  onSaved?,           // () => void — appelé APRÈS un save de séance
}) => {
  loaded: boolean
  heroProps: PlanHeroCardProps     // union active|done|rest, prête à spread
  modalsState: NextSessionModalsState
  // extras consommés UNIQUEMENT par MissionPlan (fil semaine / destination) :
  effectivePlanned: PlannedSession[]
  finalAdvice: WeekAdvice
  weekActivities: ActivityRow[]
  weekDates: string[]
  today: string
  race: Race | null
  plan: TrainingPlan | null
  openAdd: (date: string) => void
  openEditSession: (s: PlannedSession) => void
}
```

Responsabilités internes (déplacées telles quelles depuis `MissionPlan`) :

- **Fetch** : `getAllMacrocycles`, `getPlannedSessions(semaine)`, `getMainRace`,
  `pickActiveMacrocycle` ; flag `loaded` ; `reloadKey` interne **+** le
  `reloadKey` externe déclenchent un re-fetch.
- **Curseur** : état `sliderPos` (défaut 2 = « Prévu »), persisté par jour dans
  `localStorage` (`tc_form_slider_<today>`). Clé inchangée → cohérent entre les
  deux modes.
- **Moteur** : `ctx`, `plannedInputs`, `adviseWeek(...).today` → `rec` ;
  `sliderBase` ; `applySlider` → `outcome` ; `virtualToday` ; `effectivePlanned`
  ; `finalAdvice` ; `todayDone`.
- **`heroProps`** : construction de l'union `active | done | rest` (logique
  actuelle de MissionPlan, lignes ~270-292), `onOpen`/`sliderPos`/
  `onSliderChange`/`onOpenLibrary` câblés sur les handlers internes. La détection
  de l'état « done » réutilise `buildWeekFeed` (entrée du jour) — pas de logique
  d'agrégation dupliquée.
- **Handlers + état des modales** : `openAdd`, `openEditSession`,
  `openTodayEditor`, `handlePickTemplate`, `handleCreateBlank`,
  `handleSessionSaved`, `goToCreateRace`, plus l'état (`addOpen`, `editorOpen`,
  `createRaceOpen`, `replaceIds`, dates…). `handleSessionSaved` fait le ménage
  des séances remplacées, remet le curseur à « Prévu » si c'était aujourd'hui,
  bump le `reloadKey` interne, **puis appelle `onSaved?.()`**.

`heroProps` est un objet typé prêt à être spread ; le prop `onHide` n'est **pas**
inclus (ajouté par le consommateur, cf. §4).

### 2. `components/mission/NextSessionModals.tsx` (NOUVEAU) — modales partagées

Composant présentationnel rendant les 3 modales existantes
(`SessionAddSheet`, `SessionEditorModal`, `RaceEditorModal`) à partir de
`modalsState`. Évite de dupliquer ce JSX dans MissionPlan et dans le bloc expert.

### 3. `components/plan/ProchaineSeanceBlock.tsx` (NOUVEAU) — bloc expert

Wrapper mince :

```tsx
function ProchaineSeanceBlock({ freshnessPayload, recentActivities, hrZones, reloadKey, onChange }) {
  const { hideSelf } = useBlockContext()
  const s = useTodaySession({ freshnessPayload, recentActivities, hrZones, reloadKey, onSaved: onChange })
  if (!s.loaded) return null
  return (
    <>
      <PlanHeroCard {...s.heroProps} onHide={hideSelf} />
      <NextSessionModals state={s.modalsState} />
    </>
  )
}
```

`onChange` (= `bumpReload` de PlanClient) rafraîchit les blocs frères
(VueSemaine / Calendrier / Charge) quand une séance est ajoutée depuis le héros.

### 4. `components/mission/PlanHeroCard.tsx` (MODIF) — prop `onHide?`

Signature : `PlanHeroCard(props: Props & { onHide?: () => void })`.

Quand `onHide` est fourni, afficher un `⋮` (`<BlockMenu onHide={onHide} />`) en
coin haut-droit de la carte :

- état **active** : dans le cluster d'en-tête, à droite du badge « Aujourd'hui » ;
- états **done** / **rest** : en `absolute top-3 right-3 z-10`.

Le kebab ne doit pas chevaucher la poignée de drag de `BlockGrid` (centrée en
haut). Quand `onHide` est absent (mode mission), aucun kebab — rendu inchangé.

### 5. `components/blocks/BlockMenu.tsx` (NOUVEAU) — menu kebab extrait

Extraction verbatim du menu `⋮` + popup « Masquer » + gestion du clic extérieur,
aujourd'hui inline dans `BlockCard`. Props : `{ onHide: () => void; className?: string }`.
Le libellé « Masquer » vient de `common.blockHide` (déjà présent).

### 6. `components/blocks/BlockCard.tsx` (MODIF)

Remplacer le menu inline par `<BlockMenu onHide={hideSelf} />`. Aucun changement
de comportement.

### 7. `components/mission/MissionPlan.tsx` (MODIF)

Remplacer la logique héros/curseur/modales inline par un appel à
`useTodaySession(...)` (sans `onSaved`, ou `onSaved` = no-op). Conserver :

- le rendu `<PlanHeroCard {...heroProps} />` (sans `onHide`) ;
- le fil « Ma semaine » (`buildWeekFeed` + boucle d'affichage), alimenté par les
  extras du hook (`effectivePlanned`, `finalAdvice`, `weekActivities`,
  `weekDates`, `today`, handlers `openAdd`/`openEditSession`) ;
- la destination compacte / `RythmeCard` / bouton coach ;
- `<NextSessionModals state={...} />` en bas.

Le rendu du mode mission doit rester **identique** (objectif de non-régression).

### 8. `app/(main)/plan/page.tsx` (MODIF)

Le fetch des 3 jeux de données serveur (`freshnessPayload`, `recentActivities`
sur 28 j, `hrZones`) n'a lieu aujourd'hui que dans la branche mission. L'extraire
dans un helper `loadHeroData(user)` appelé dans les **deux** branches, et passer
le résultat à `PlanClient` (mode expert) comme à `MissionPlan`.

### 9. `app/(main)/plan/PlanClient.tsx` (MODIF)

- Nouveaux props : `freshnessPayload`, `recentActivities`, `hrZones`.
- `DEFAULT_ORDER` : préfixer `'prochaine-seance'`.
- Nouveau `BlockDef` :

```ts
{
  id: 'prochaine-seance',
  label: L.blockProchaineSeance,
  emoji: '🏃',
  render: () => (
    <ProchaineSeanceBlock
      freshnessPayload={freshnessPayload}
      recentActivities={recentActivities}
      hrZones={hrZones}
      reloadKey={reloadKey}
      onChange={bumpReload}
    />
  ),
}
```

### 10. `lib/i18n/dictionaries/{fr,en}.ts` (MODIF)

Ajouter `plan.blockProchaineSeance` au type (`fr.ts` lignes ~545-546) et aux
valeurs : `'Prochaine séance'` (fr) / `'Next session'` (en).

## Flux de données

```
page.tsx (server)
  └─ loadHeroData(user) → { freshnessPayload, recentActivities, hrZones }
       ├─ mission  → <MissionPlan ...data />
       └─ expert   → <PlanClient ...data />
                        └─ BlockGrid → ProchaineSeanceBlock(...data, reloadKey, onChange)
                                          └─ useTodaySession(...) ──┐
MissionPlan ─ useTodaySession(...) ───────────────────────────────┘  (même hook)
```

## Gestion des erreurs / cas limites

- **Pas d'utilisateur / pas de données** : `loadHeroData` renvoie des valeurs
  nulles/vides ; le hook dégrade proprement (`loaded` finit à `true`, état
  « repos » par défaut) — comportement actuel de MissionPlan préservé.
- **`!loaded`** : `ProchaineSeanceBlock` renvoie `null` (pas de flash). Le bloc
  reste dans `BlockGrid` (déplaçable/masquable) dès qu'il est monté.
- **Conflit DnD** : aucun. Le bloc n'a pas de DnD interne (contrairement à
  `semaine-bibliotheque`) ; il vit donc directement comme item `BlockGrid`.

## Tests

- **Non-régression** : `__tests__/components/mission/MissionPlan.test.tsx` et
  `__tests__/lib/mission/session-advisor.test.ts` doivent rester verts.
- **Nouveau** : test de `ProchaineSeanceBlock` — rend le héros quand `loaded`,
  `onHide` déclenche `hideSelf`, `onSaved` appelé après save. Mock du hook ou des
  fetchs `lib/plan/storage`.
- Rappel : ~50 tests jest échouent en pré-existant (useI18n hors provider) —
  lancer uniquement les suites pertinentes.
- Vérif visuelle manuelle : mode mission identique + bloc expert (drag, masquer,
  ré-affichage via « Ajouter un bloc », curseur, ouverture des modales).

## Hors périmètre

- Aucune migration Supabase (pas de schéma touché).
- Pas de modification du moteur `session-advisor` ni de `PlanHeroCard` au-delà du
  prop `onHide`.
- Pas d'unification du `reloadKey` interne du hook avec celui de PlanClient
  au-delà du `onSaved`/`reloadKey` décrits.
