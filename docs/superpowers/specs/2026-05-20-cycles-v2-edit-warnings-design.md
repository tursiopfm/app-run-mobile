# Spec — Cycles d'entraînement v2 · Édition + warnings (sub-project C)

> **Status: Supersédé** · 2026-05-22 · Module supprimé via `chore/cycles-simplify` car trop complexe pour l'utilisateur lambda. Garder les références pour la phase Coach IA future.
> ~~**Status: Implémenté** · 2026-05-20~~
> **Périmètre :** finir l'édition multi-macros (focus, loadPattern, weekType par-semaine), basculer la persistance sur `mesocycle_weeks`, livrer 5 warnings pédagogiques.

## Goal

Compléter le module Cycles v2 livré en A (data) + B (lecture / timeline) avec :
1. **Édition complète** de tous les nouveaux champs (focus, loadPattern, weekType, comment) dans `PhaseEditorModal`.
2. **Bascule persistance** : la lecture/écriture des semaines passe du JSONB `phases.weekly_targets` (legacy) à la table dédiée `mesocycle_weeks` (créée en A). `is_manual_override` est marqué automatiquement à chaque édition.
3. **Régénération contrôlée** : boutons "Régénérer (préserve mes modifs)" et "Forcer (efface)" par phase, avec confirmation pour la version destructive.
4. **5 warnings pédagogiques** affichés en bandeau sous la timeline.

## Problème actuel

À la fin du sub-project B :
- Le sélecteur multi-macros, la timeline et l'expand read-only marchent.
- Mais **l'édition n'a pas évolué depuis A** : `PhaseEditorModal` n'expose toujours pas les champs `focus` / `loadPattern` / `weekType`, et écrit dans le JSONB `weekly_targets` au lieu de `mesocycle_weeks`. Conséquence : l'utilisateur peut voir les nouvelles données dans la DB mais pas les éditer depuis l'app.
- **Aucun warning** : un user qui crée 2 phases qui se chevauchent ou une course A sans taper ne reçoit aucun signal — il faut littéralement lire le data model pour s'en rendre compte.

## Décisions structurantes (validées en brainstorming)

| # | Décision | Raison |
|---|---|---|
| 1 | C en un seul sub-project (édition + warnings) | Volume similaire à A et B, scope cohérent |
| 2 | Switch complet JSONB → `mesocycle_weeks` | Migration 022 déjà appliquée en prod ; le double-write serait du gaspillage |
| 3 | Édition uniquement dans `PhaseEditorModal` (pas inline) | Évite la duplication ; l'expand de StructurePrepaBlock reste read-only |
| 4 | Boutons Régénérer/Forcer dans le panneau déplié de chaque phase | Contextuel, découvrable, granularité par phase |
| 5 | Warnings en bandeau sous la timeline | Visible immédiatement, dismissibles via tap-expand |
| 6 | Pas de dismissal V1 | Les warnings reflètent la data ; quand l'user corrige, ils disparaissent |
| 7 | Pas de migration SQL | Tout le schéma vit depuis A |
| 8 | YAGNI sur `resetWeek` par-semaine | Le bouton "Forcer (efface)" par phase couvre déjà le besoin |

## Architecture & fichiers

```
web/
  lib/training/
    plan-warnings.ts                            ← NEW (moteur pur computeWarnings)
    mesocycle-weeks.ts                          ← EXTEND (updateWeek + count of overrides)
  components/plan/
    PhaseEditorModal.tsx                        ← MODIFY (focus, loadPattern, weekType, comment editors + regen/force buttons)
    StructurePrepaBlock.tsx                     ← MODIFY (lit weeksByPhase prop, weekType chip réel, intègre PlanWarnings)
    PlanWarnings.tsx                            ← NEW (bandeau sous timeline)
    RegenerateConfirmDialog.tsx                 ← NEW (mini-modale de confirmation pour Forcer)
  app/(main)/plan/
    PlanClient.tsx                              ← MODIFY (fetch weeksByPhase, passe macros + weeksByPhase à StructurePrepaBlock)
  __tests__/
    lib/training/plan-warnings.test.ts          ← NEW (~12 cas)
    lib/training/mesocycle-weeks-edit.test.ts   ← NEW (~3 cas updateWeek)
```

**Principe d'isolation** :
- `plan-warnings.ts` est un module pur sans React/Supabase, testé en isolation.
- `PlanWarnings.tsx` reçoit les warnings calculés en prop (pas de fetch interne).
- `RegenerateConfirmDialog.tsx` est réutilisable (peut servir à d'autres "confirm destructive" plus tard).

**Aucune migration SQL.** Tout est déjà en place depuis A.

## Storage (`web/lib/training/mesocycle-weeks.ts` — extension)

Le module a déjà `getWeeksForPhase` + `regenerateWeeks` (livrés en A). On ajoute :

```ts
/**
 * Patch une semaine existante. Marque AUTOMATIQUEMENT is_manual_override=true.
 * Utilisé par l'édition dans PhaseEditorModal (km/D+/TSS/weekType/comment).
 * Retourne null si la row n'existe pas ou si Supabase échoue (logué).
 */
export async function updateWeek(
  weekId: string,
  patch: Partial<Pick<MesocycleWeek,
    'weekType' | 'targetLoadTss' | 'targetVolumeKm' | 'targetDplusM' | 'comment'
  >>,
): Promise<MesocycleWeek | null>
```

**Implémentation** :
1. Construire un row partial avec les champs présents dans `patch` (mappés snake_case côté DB).
2. Forcer `is_manual_override = true` et `generated_from_pattern = false` dans le row.
3. UPSERT (ou `update().eq('id', weekId)`) sur `mesocycle_weeks`.
4. Sur erreur : `console.warn` + retourner null. Cohérent avec le pattern du reste du module.

`resetWeek` non livré en V1.

## Édition mésocycle (`PhaseEditorModal.tsx`)

### 4.1 — Nouveaux champs au niveau de la phase

Dans le panneau déplié, après les champs `Début` / `Fin`, **insérer une nouvelle row** :

```tsx
<div className="grid grid-cols-2 gap-2">
  <Field label="Focus (libre)">
    <input
      type="text"
      value={phase.focus ?? ''}
      onChange={(e) => onChange({ focus: e.target.value })}
      placeholder="Base aérobie, VMA, Côtes…"
      className="…"
    />
  </Field>

  <Field label="Pattern de charge">
    <select
      value={phase.loadPattern}
      onChange={(e) => onChange({ loadPattern: e.target.value as LoadPattern })}
      className="…"
    >
      <option value="custom">custom (manuel)</option>
      <option value="progressive_3_1">progressive 3:1</option>
      <option value="progressive_2_1">progressive 2:1</option>
      <option value="taper">taper</option>
      <option value="maintenance">maintenance</option>
      <option value="recovery">recovery</option>
      <option value="competition">competition</option>
    </select>
  </Field>
</div>
```

### 4.2 — Tableau hebdo branché sur `mesocycle_weeks`

Le tableau actuel lit `getPhaseWeeks(phase)` (JSONB). On bascule :

1. **Lecture** : `useEffect` keyed sur `phase.id` qui appelle `getWeeksForPhase(phase.id)` → state local `weeks: MesocycleWeek[]`.
2. **Layout** : passe de 3 colonnes (Sem | Volume | D+) à **5 colonnes** : Sem | Type | Km | D+ | TSS. Chip ✎ orange affiché si `week.isManualOverride === true`.
3. **Édition** :
   - Sélecteur `<select>` pour `weekType` avec les 7 valeurs (`load`/`deload`/`recovery`/`taper`/`race`/`transition`/`custom`).
   - Inputs `<input type="number">` pour km / D+ / TSS, persistance `onBlur` (pas à chaque keystroke).
   - Chaque édition appelle `updateWeek(week.id, patch)` → update optimiste du state local + appel Supabase background.
4. **Champ `comment`** : textarea repliable par-semaine (replié par défaut, icone 💬 dans le header de ligne pour ouvrir si présent).

Sur erreur Supabase, on log et on garde l'update optimiste — l'user voit la valeur, le prochain refetch corrigera si besoin. Pas de revert UX pour rester simple.

### 4.3 — Boutons Régénérer / Forcer par phase

Sous le tableau hebdo, dans le panneau déplié, **2 boutons côte à côte** :

```tsx
<div className="flex flex-wrap gap-2 pt-2 border-t border-trail-border">
  <button onClick={() => handleRegenerate(phase, { forceOverwrite: false })}
          disabled={phase.loadPattern === 'custom'}>
    ↻ Régénérer (préserve mes modifs)
  </button>
  <button onClick={() => handleClickForce(phase)}
          disabled={phase.loadPattern === 'custom'}>
    ↻ Forcer (efface)
  </button>
</div>
```

**`handleRegenerate(phase, opts)`** :
1. Appelle `regenerateWeeks(phase, opts)`.
2. Refetch `getWeeksForPhase(phase.id)` → met à jour le tableau.
3. Notifie le parent via `onSaved()` (refresh du bloc Structure).

**`handleClickForce(phase)`** :
1. Compte les semaines avec `is_manual_override=true` (lecture du state `weeks`).
2. Si 0 overrides → appelle directement `handleRegenerate(phase, { forceOverwrite: true })` (rien à perdre).
3. Sinon → ouvre `<RegenerateConfirmDialog>` avec le nombre.

**Disabled state pour `custom`** :
- Les 2 boutons sont disabled avec tooltip `Pattern 'custom' = pas de régénération automatique. Édite directement les semaines.`

## Confirm dialog (`RegenerateConfirmDialog.tsx`)

Mini-modale réutilisable.

```tsx
type Props = {
  open: boolean
  phaseLabel: string
  weekCountWithOverride: number
  onConfirm: () => void
  onCancel: () => void
}
```

Pattern aligné avec `ConfirmDialog` existant (createPortal, aria-modal, Escape).

**Contenu** :
- Titre : `Forcer la régénération ?`
- Body : `{N} semaine{s} modifiée{s} manuellement seront écrasées par les valeurs du pattern '{loadPattern}' du cycle '{phaseLabel}'. Cette action est irréversible.`
- Boutons : `Annuler` (gris) / `Forcer` (rouge).

## Moteur de warnings (`lib/training/plan-warnings.ts`)

Module pur. Aucune dépendance React/Supabase.

### Types exportés

```ts
export type WarningSeverity = 'info' | 'warning' | 'critical'

export type WarningKind =
  | 'race_a_orphan'
  | 'taper_missing'
  | 'sharp_ramp'
  | 'phase_gap'
  | 'phase_overlap'

export interface PlanWarning {
  id: string          // hash stable basé sur kind + ressource
  kind: WarningKind
  severity: WarningSeverity
  title: string
  detail: string
  phaseId?: string
  raceId?: string
  weekIndex?: number
}

export interface WarningInput {
  macros: TrainingPlan[]
  activeMacrocycle: TrainingPlan | null
  races: Race[]
  weeksByPhase: Record<string, MesocycleWeek[]>
}

export function computeWarnings(input: WarningInput): PlanWarning[]
```

### Règles

| Kind | Trigger | Severity |
|---|---|---|
| `race_a_orphan` | `race.priority === 'A'` ET aucun macro ne couvre `race.date`. | `critical` |
| `taper_missing` | Race A dans un macro mais aucune phase `affutage` qui se termine entre `race.date - 14j` et `race.date`. | `warning` |
| `sharp_ramp` | `w[i+1].targetVolumeKm > w[i].targetVolumeKm * 1.20` OU charge `* 1.20` OU D+ `* 1.30` (constantes en haut du fichier). | `info` |
| `phase_gap` | `p[i+1].startDate > p[i].endDate` (au moins 1 jour de gap). | `info` |
| `phase_overlap` | `p[i+1].startDate < p[i].endDate`. | `warning` |

### Constantes

```ts
const SHARP_RAMP_VOLUME_RATIO = 1.20
const SHARP_RAMP_LOAD_RATIO = 1.20
const SHARP_RAMP_DPLUS_RATIO = 1.30
const TAPER_LOOKBACK_DAYS = 14
```

### Tests (`plan-warnings.test.ts`, ~12 cas)

| # | Cas | Attendu |
|---|---|---|
| 1 | Empty input (0 races, 0 phases) | `[]` |
| 2 | Race A dans la fenêtre macro | Pas de `race_a_orphan` |
| 3 | Race A hors macro | 1 `race_a_orphan` critical |
| 4 | Race A in-macro avec phase `affutage` qui finit J-3 | Pas de `taper_missing` |
| 5 | Race A in-macro sans phase `affutage` | 1 `taper_missing` warning |
| 6 | Race A in-macro avec `affutage` finissant J-20 (hors fenêtre 14j) | `taper_missing` quand même |
| 7 | Sem N+1 volume = sem N × 1.25 | 1 `sharp_ramp` |
| 8 | Sem N+1 volume = sem N × 1.10 | Pas de warning |
| 9 | 2 phases avec gap (p1.end=2026-06-01, p2.start=2026-06-05) | 1 `phase_gap` |
| 10 | 2 phases qui se touchent (p1.end = p2.start) | Pas de warning |
| 11 | 2 phases qui se chevauchent (p2.start < p1.end) | 1 `phase_overlap` |
| 12 | Race B/C (priorité ≠ A) | Aucun warning race_a_* ni taper_missing |

## UI warnings (`PlanWarnings.tsx`)

```tsx
type Props = {
  warnings: PlanWarning[]
  onPhaseClick?: (phaseId: string) => void
}
```

**Rendu** :
- Carte compacte sous la timeline avec header `⚠ Suggestions · N` + chevron pour tout replier.
- Liste de warnings, 1 ligne chacun :
  - Icon par severity (`info` 💡 / `warning` ⚠ / `critical` ⚡).
  - `title` en bold.
  - Tap → toggle expand du warning courant (une seule à la fois).
- Expand d'un warning :
  - `detail` en texte 2 lignes max.
  - Bouton CTA :
    - Si `phaseId` → "Voir le cycle" → appelle `onPhaseClick(phaseId)` (provoque l'expand du segment dans la timeline).
    - Si `raceId` → lien `<a href="/plan/courses/${raceId}">` "Voir la course" (navigation native vers la page détail).

**Tri** : par severity (`critical` > `warning` > `info`), puis par `kind` dans l'ordre `race_a_orphan, taper_missing, phase_overlap, phase_gap, sharp_ramp`.

**État vide** : si `warnings.length === 0`, retourne `null` (pas de carte affichée).

## Intégration `StructurePrepaBlock`

Props mises à jour :

```tsx
type Props = {
  activeMacrocycle: TrainingPlan | null
  races: Race[]
  macros: TrainingPlan[]                            // ← NEW
  weeksByPhase: Record<string, MesocycleWeek[]>     // ← NEW
  onChange?: () => void
}
```

**Changements** :
1. **Lecture du tableau hebdo (expand read-only)** : utilise `weeksByPhase[phase.id]` au lieu de `getPhaseWeeks(phase)`. Affiche le vrai `weekType` chip (couleurs depuis la map `WEEK_TYPE_COLOR` existante).
2. **`<PlanWarnings />`** rendu entre la timeline et le panneau expand :
   ```tsx
   <PlanWarnings
     warnings={useMemo(() => computeWarnings({ macros, activeMacrocycle, races, weeksByPhase }), [...])}
     onPhaseClick={(id) => setExpandedId(id)}      // expand directement le segment dans la timeline
   />
   ```
   Le callback `onRaceClick` est volontairement **omis en V1**. Pour les warnings liés à une course (`race_a_orphan`, `taper_missing`), `PlanWarnings` rend un `<a href="/plan/courses/${raceId}">` côté composant — pas besoin de callback ni de lifting du drawer d'`RaceMarkers`. YAGNI.
3. Pas de changement sur la timeline elle-même ni le sélecteur de macro.

## Intégration `PlanClient.tsx`

Fetch supplémentaire :

```tsx
const [weeksByPhase, setWeeksByPhase] = useState<Record<string, MesocycleWeek[]>>({})

useEffect(() => {
  let cancelled = false
  void (async () => {
    const [m, r] = await Promise.all([getAllMacrocycles(), getRaces()])
    if (cancelled) return
    setMacros(m)
    setRaces(r)
    // Fetch toutes les semaines de toutes les phases en parallèle.
    const phaseIds = m.flatMap(macro => macro.phases.map(p => p.id))
    const weeksPerPhase = await Promise.all(phaseIds.map(getWeeksForPhase))
    if (cancelled) return
    const map: Record<string, MesocycleWeek[]> = {}
    phaseIds.forEach((id, i) => { map[id] = weeksPerPhase[i] })
    setWeeksByPhase(map)
  })()
  return () => { cancelled = true }
}, [reloadKey])
```

Passe `macros` et `weeksByPhase` aux nouveaux props de `StructurePrepaBlock`.

**Optimisation différée** : si jamais le nombre de phases × N macros devient > 30, on pourra écrire un helper `getWeeksForPlan(planId)` qui fait 1 SELECT join. YAGNI V1.

## Compat & rollout

- **Pas de migration SQL** : tout est déjà en place depuis A.
- **Lecture JSONB** retirée des chemins UI. Le JSONB `phases.weekly_targets` reste écrit en miroir par `saveCurrentPlan` (déjà fait depuis A) pour ne pas casser un éventuel rollback ; un cleanup retire ce double-write en sub-project D ou plus tard.
- **Rollback** : revert Git. La table `mesocycle_weeks` peut rester pleine sans impact.
- **Smoke test manuel** : éditer une semaine via la modale → vérifier ✎, fermer/rouvrir, modif persistée. Régénérer (préserve) → semaine modifiée intacte. Forcer → confirm dialog → reset OK. Vérifier qu'un warning apparaît si on crée 2 phases qui se chevauchent.

## Hors scope (renvoyé à D ou plus tard)

- **Templates de prépa** (ultra / trail court / reprise) — sub-project D.
- **Suppression du double-write JSONB legacy** — cleanup après D.
- **`resetWeek` par-semaine** — YAGNI V1.
- **Dismissal de warnings** — YAGNI V1.
- **Optimisation `getWeeksForPlan(planId)`** en 1 query JOIN — YAGNI tant que le compte phases × macros reste raisonnable.
- **Warnings cross-macro** plus avancés (ex : "course A dans 2 macros") — V2.
- **Edit inline depuis StructurePrepaBlock** — déjà acté hors-scope : la modale reste le seul point d'édition.

## Critères d'acceptation

- `npm run build` passe sans warning TS.
- `npm test` passe (438 + ~15 nouveaux tests = ~453).
- `npm run lint` clean.
- Dans `PhaseEditorModal`, sur une phase dépliée : champs `focus` (text) et `loadPattern` (select 7 valeurs) éditables + persistés.
- Dans le tableau hebdo de `PhaseEditorModal` : colonne `weekType` (select) + km/D+/TSS éditables + chip ✎ visible quand `is_manual_override=true`.
- Au pied du panneau, boutons `↻ Régénérer (préserve)` et `↻ Forcer (efface)` opérationnels. Le bouton Forcer ouvre `RegenerateConfirmDialog` si au moins 1 semaine est overrideée.
- Sous la timeline de `StructurePrepaBlock`, un bandeau `⚠ Suggestions` apparaît si `computeWarnings` retourne ≥ 1 warning. Tap sur un warning → expand avec CTA "Voir le cycle / course".
- Une course A créée hors macro déclenche immédiatement le warning `race_a_orphan` critical.
- Une course A dans un macro sans phase `affutage` déclenche `taper_missing` warning.
- Deux phases qui se chevauchent déclenchent `phase_overlap` warning.
- L'expand read-only de `StructurePrepaBlock` affiche désormais les **vrais** `weekType` lus depuis `mesocycle_weeks` (au lieu du placeholder `'load'` hardcodé).
