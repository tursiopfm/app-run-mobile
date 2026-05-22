# Spec — Cycles d'entraînement v2 · Templates de prépa (sub-project D)

> **Status: Supersédé** · 2026-05-22 · Module supprimé via `chore/cycles-simplify` car trop complexe. Garder les recipes de templates (ultra/trail_court/reprise) comme référence pour la phase Coach IA future.
> ~~**Status: Implémenté** · 2026-05-20~~
> **Périmètre :** ajouter 4 presets de prépa (ultra / trail_court / reprise / personnalisé) sélectionnables dans la modale de création de macrocycle, avec génération auto des mésocycles et compression proportionnelle si la durée disponible est courte.

## Goal

Compléter le module Cycles v2 (A foundation + B timeline + C édition) avec la couche pédagogique de pré-remplissage : à la création d'un macrocycle pour une course objectif, l'utilisateur choisit un template adapté au type d'épreuve et obtient en un clic une structure de mésocycles complète avec leurs `focus` / `loadPattern` configurés.

Bonus implicite : les `mesocycle_weeks` sont générées automatiquement au save (via le `regenerateWeeks` déjà branché depuis A), donc l'utilisateur arrive directement à un plan **complètement structuré** prêt à l'édition fine.

## Problème actuel

Après C :
- L'utilisateur peut créer un macrocycle vide (`NewMacrocycleModal`) ou auto-générer une structure générique via `autoDistributePhases(start, raceDate)` depuis `PhaseEditorModal`.
- Mais `autoDistributePhases` est **agnostique du type de course** : il produit toujours foncier → développement → spécifique → affûtage → récupération avec des ratios `40/30/20/10` sans tenir compte du fait qu'une prépa ultra et une prépa trail court devraient avoir des structures différentes (proportions, focus, loadPattern).
- Aucun moyen d'exprimer "je prépare un ultra avec emphase sur le D+" ou "je reprends après blessure" — l'utilisateur doit éditer manuellement chaque phase après auto-génération.

## Décisions structurantes (validées en brainstorming)

| # | Décision | Raison |
|---|---|---|
| 1 | Templates hard-codés dans `lib/training/prep-templates.ts` | YAGNI : pas besoin de templates dynamiques pour V1 ; édition = modifier le code |
| 2 | Intégration dans `NewMacrocycleModal` (extension) | Le bouton `+ Nouveau` reste l'unique point d'entrée, scope clair |
| 3 | 4 templates V1 : `ultra`, `trail_court`, `reprise`, `custom` | Couvre les cas typiques trail/ultra ; `custom` = comportement actuel (macro vide) |
| 4 | Compression proportionnelle si durée < nominalWeeks | Tolère les prépas raccourcies (cas réel pour les inscriptions tardives) |
| 5 | Pas de toast post-save | Warning live dans la modale suffit, économise du code |
| 6 | `saveCurrentPlan` (existant) déclenche `regenerateWeeks` automatiquement | Réutilise l'infra A, zéro code en plus pour les semaines |
| 7 | Zero migration SQL | `templateId` colonne + persistance déjà en place depuis A |

## Architecture & fichiers

```
web/
  lib/training/
    prep-templates.ts                       ← NEW (4 templates + applyTemplate)
  __tests__/lib/training/
    prep-templates.test.ts                  ← NEW (~10 cas)
  components/plan/
    NewMacrocycleModal.tsx                  ← MODIFY (ajout select Template + preview + handleSave)
```

**Principe d'isolation** : `prep-templates.ts` est un module pur (entrée: templateId + dates → sortie: Phase[] + meta). Aucune dépendance React/Supabase. Testable en isolation.

## Module `lib/training/prep-templates.ts`

### Types exportés

```ts
import type { LoadPattern, Phase, PhaseType } from '@/types/plan'

export type PrepTemplateId = 'ultra' | 'trail_court' | 'reprise' | 'custom'

export interface TemplatePhaseRecipe {
  type: PhaseType
  label: string
  focus?: string
  loadPattern: LoadPattern
  weeks: number    // durée nominale en semaines (avant compression)
}

export interface PrepTemplate {
  id: PrepTemplateId
  label: string          // 'Ultra', 'Trail court', 'Reprise', 'Personnalisé'
  description: string    // 1 ligne UI ('Foncier 6s · Force/D+ 5s · …')
  nominalWeeks: number   // somme des weeks
  minWeeks: number       // en dessous → compression forte mais on génère quand même
  recipes: TemplatePhaseRecipe[]
}

export interface ApplyTemplateResult {
  phases: Phase[]
  meta: {
    nominalWeeks: number
    availableWeeks: number
    compressed: boolean
    error?: 'too_short'
  }
}
```

### Les 4 templates

```ts
export const PREP_TEMPLATES: Record<PrepTemplateId, PrepTemplate> = {
  ultra: {
    id: 'ultra',
    label: 'Ultra',
    description: 'Foncier 6s · Force/D+ 5s · Spécifique 6s · Sim 2s · Taper 2s',
    nominalWeeks: 21,
    minWeeks: 12,
    recipes: [
      { type: 'foncier',       label: 'Foncier base aérobie', focus: 'Base aérobie',         loadPattern: 'progressive_3_1', weeks: 6 },
      { type: 'developpement', label: 'Force / D+',           focus: 'Force / Côtes / D+',   loadPattern: 'progressive_3_1', weeks: 5 },
      { type: 'specifique',    label: 'Spécifique ultra',     focus: 'Spécifique terrain',   loadPattern: 'progressive_2_1', weeks: 6 },
      { type: 'specifique',    label: 'Simulation course',    focus: 'Sorties longues sim.', loadPattern: 'maintenance',     weeks: 2 },
      { type: 'affutage',      label: 'Affûtage',             focus: 'Taper',                loadPattern: 'taper',           weeks: 2 },
    ],
  },
  trail_court: {
    id: 'trail_court',
    label: 'Trail court',
    description: 'Foncier 4s · VMA 4s · Seuil 3s · Spé 3s · Taper 1s',
    nominalWeeks: 15,
    minWeeks: 8,
    recipes: [
      { type: 'foncier',       label: 'Foncier base aérobie', focus: 'Base aérobie',      loadPattern: 'progressive_3_1', weeks: 4 },
      { type: 'developpement', label: 'VMA',                  focus: 'VMA / VO2max',      loadPattern: 'progressive_3_1', weeks: 4 },
      { type: 'developpement', label: 'Seuil',                focus: 'Seuil / tempo',     loadPattern: 'progressive_2_1', weeks: 3 },
      { type: 'specifique',    label: 'Spécifique trail',     focus: 'Côtes / terrain',   loadPattern: 'progressive_2_1', weeks: 3 },
      { type: 'affutage',      label: 'Affûtage',             focus: 'Taper',             loadPattern: 'taper',           weeks: 1 },
    ],
  },
  reprise: {
    id: 'reprise',
    label: 'Reprise',
    description: 'Récup 2s · Foncier 6s · Développement 4s',
    nominalWeeks: 12,
    minWeeks: 6,
    recipes: [
      { type: 'recuperation',  label: 'Reprise progressive', focus: 'Régénération',     loadPattern: 'recovery',        weeks: 2 },
      { type: 'foncier',       label: 'Foncier',             focus: 'Reconstruction',   loadPattern: 'progressive_3_1', weeks: 6 },
      { type: 'developpement', label: 'Développement',       focus: 'Premières allures', loadPattern: 'progressive_2_1', weeks: 4 },
    ],
  },
  custom: {
    id: 'custom',
    label: 'Personnalisé',
    description: 'Macro vide à remplir manuellement',
    nominalWeeks: 0,
    minWeeks: 0,
    recipes: [],
  },
}
```

### API publique

```ts
/**
 * Génère les Phase[] pour un macrocycle qui débute à `macroStartISO` et termine
 * à `macroEndISO`. Compression proportionnelle si la durée disponible est
 * inférieure à `nominalWeeks` du template.
 *
 * Cas `templateId === 'custom'` : retourne `[]`, compressed=false.
 * Cas `availableWeeks < 1` : retourne `[]` + `meta.error: 'too_short'`.
 * Cas `availableWeeks < minWeeks` : on génère quand même avec `compressed: true`.
 */
export function applyTemplate(
  templateId: PrepTemplateId,
  macroStartISO: string,
  macroEndISO: string,
): ApplyTemplateResult
```

### Algorithme `applyTemplate`

1. Récupérer `tpl = PREP_TEMPLATES[templateId]`.
2. Si `tpl.recipes.length === 0` (cas `custom`) → return `{ phases: [], meta: { nominalWeeks: 0, availableWeeks: ..., compressed: false } }`.
3. Calculer `availableWeeks = Math.max(0, Math.ceil((macroEnd - macroStart) / 7))` (jours / 7, arrondi vers le haut).
4. Si `availableWeeks < 1` → return `{ phases: [], meta: { …, error: 'too_short' } }`.
5. `ratio = availableWeeks / tpl.nominalWeeks` (peut être > 1 si l'utilisateur a alloué plus que le nominal).
6. Pour chaque `recipe` (dans l'ordre), `compressedWeeks = Math.max(1, Math.round(recipe.weeks * ratio))`. Le `max(1, …)` garantit qu'aucune phase ne disparaît.
7. Allouer les dates : `cursor = macroStartISO`. Pour chaque recipe, `phase.startDate = cursor`, `phase.endDate = cursor + compressedWeeks * 7j`, puis `cursor = phase.endDate`.
8. **Ajuster la dernière phase** pour que son `endDate` corresponde exactement à `macroEndISO` (gestion des arrondis cumulés). Si l'ajustement donnerait `endDate < startDate`, on garde au moins 1 jour de phase.
9. Pour chaque Phase, fixer les baselines km/D+/TSS via les défauts existants de `phases.ts` (`DEFAULT_WEEKLY_CHARGE[type]`, `DEFAULT_WEEKLY_DISTANCE_KM[type]`, `DEFAULT_WEEKLY_ELEVATION_M[type]`). **Note implémentation** : ces 3 constantes sont actuellement privées dans `phases.ts`. Les exposer en `export const` pour les consommer depuis `prep-templates.ts` (1 ligne par constante à modifier). Évite la duplication.
10. Retourner `{ phases, meta: { nominalWeeks, availableWeeks, compressed: availableWeeks < tpl.nominalWeeks } }`.

### Tests `prep-templates.test.ts` (~10 cas)

| # | Cas | Attendu |
|---|---|---|
| 1 | `custom` template → `[]`, compressed=false | OK |
| 2 | `ultra`, 21 sem disponibles → 5 phases [6,5,6,2,2], compressed=false | OK |
| 3 | `ultra`, 14 sem disponibles → 5 phases, total=14 sem, compressed=true, ratio≈0.67 | OK |
| 4 | Compression : recipe.weeks=1 ne tombe pas à 0 (min 1) | OK |
| 5 | Dernière phase ajustée pour `endDate === macroEnd` exactement | OK |
| 6 | `reprise`, 4 sem (< minWeeks=6) → génère quand même, compressed=true | OK |
| 7 | 0 jour disponible → `phases: []`, `meta.error: 'too_short'` | OK |
| 8 | Ordre des phases préservé (foncier → spé → affût) | OK |
| 9 | `loadPattern` correctement assigné (foncier→progressive_3_1, affutage→taper) | OK |
| 10 | `focus` text propagé dans la Phase générée | OK |

## Intégration `NewMacrocycleModal`

### Imports ajoutés

```tsx
import { applyTemplate, PREP_TEMPLATES, type PrepTemplateId } from '@/lib/training/prep-templates'
import type { Phase } from '@/types/plan'  // si pas déjà importé
```

### Nouveau state

```tsx
const [templateId, setTemplateId] = useState<PrepTemplateId>('custom')

// Preview live : recalcule dès qu'on change template ou dates
const templatePreview = useMemo(() => {
  if (templateId === 'custom') return null
  return applyTemplate(templateId, startDate, endDate)
}, [templateId, startDate, endDate])
```

### Nouveau bloc UI (juste après le select Course objectif)

```tsx
<Field label="Template de prépa">
  <select
    value={templateId}
    onChange={(e) => setTemplateId(e.target.value as PrepTemplateId)}
    className="…"
  >
    {Object.values(PREP_TEMPLATES).map(t => (
      <option key={t.id} value={t.id}>
        {t.label}{t.nominalWeeks > 0 ? ` · ${t.nominalWeeks} sem nominales` : ''}
      </option>
    ))}
  </select>
</Field>

{templateId !== 'custom' && (
  <p className="text-[11px] text-[color:var(--trail-muted)] mt-1 px-1 leading-relaxed">
    {PREP_TEMPLATES[templateId].description}
  </p>
)}

{templatePreview && templatePreview.meta.compressed && !templatePreview.meta.error && (
  <p className="text-[11px] text-[color:var(--trail-yellow)] mt-1 px-1">
    ⚠ Prépa compressée : {templatePreview.meta.nominalWeeks} → {templatePreview.meta.availableWeeks} sem disponibles.
  </p>
)}

{templatePreview?.meta.error === 'too_short' && (
  <p className="text-[11px] text-red-400 mt-1 px-1">
    Période trop courte pour appliquer ce template. Choisis 'Personnalisé' ou allonge la fin.
  </p>
)}
```

### Modification `handleSave`

Le flux save est étendu : si `templateId !== 'custom'`, on appelle `applyTemplate` et on injecte les phases dans le plan.

```tsx
let phases: Phase[] = []
if (templateId !== 'custom') {
  const result = applyTemplate(templateId, startDate, endDate)
  if (result.meta.error === 'too_short') {
    setError('Période trop courte pour ce template.')
    return
  }
  phases = result.phases
}

const plan: TrainingPlan = {
  // … existants
  phases,                                                       // ← injecté par le template
  templateId: templateId === 'custom' ? undefined : templateId, // ← persistance du choix
  // …
}
await saveMacrocycle(plan)
```

`saveCurrentPlan` (sous-jacent à `saveMacrocycle`) appelle déjà `regenerateWeeks(phase)` pour chaque phase avec `loadPattern !== 'custom'` (depuis A). Donc les `mesocycle_weeks` sont automatiquement générées à la sauvegarde.

### Reset du form

Le `useEffect` qui reset les champs à l'ouverture de la modale doit aussi réinitialiser `templateId` à `'custom'`.

## Compat & rollout

- **Pas de migration SQL** : la colonne `training_plans.template_id` existe depuis A, le type `TrainingPlan.templateId` aussi.
- **Backward compatible** : un macrocycle existant (créé sans template) garde `templateId = null/undefined`. Aucun impact.
- **`saveCurrentPlan` → `regenerateWeeks` automatique** : depuis A, donc les semaines sont générées au save de manière transparente.
- **Rollback** = revert Git. Aucune donnée DB à nettoyer.

## Hors scope (renvoyé à V2 ou plus tard)

- **Templates en DB** (table `prep_templates`, édition par l'utilisateur) — YAGNI V1.
- **Slot "template perso" sauvegardé depuis un macro existant** — V2.
- **Plus de templates** (route, cross, marathon, demi-marathon) — quand le besoin se présente.
- **Édition par-phase des baselines km/D+/TSS dans le template** — pour V1 on utilise les défauts par type (`DEFAULT_WEEKLY_*` de `phases.ts`).
- **Toast post-save de compression** — le warning live dans la modale suffit en V1.
- **Bouton "Re-appliquer le template" depuis un macro existant** (effacer les phases actuelles et regénérer depuis le templateId persisté) — V2 si besoin.

## Critères d'acceptation

- `npm run build` passe sans warning TS.
- `npm test` passe (453 + 10 = ~463).
- `npm run lint` clean.
- Dans `NewMacrocycleModal`, un select **Template** apparaît après "Course objectif".
- Les 4 templates sont sélectionnables : `Personnalisé`, `Ultra`, `Trail court`, `Reprise`.
- La description du template choisi s'affiche sous le select.
- Si la durée disponible < nominalWeeks, un warning ⚠ jaune apparaît live.
- Si la durée disponible < 1 jour, un message rouge "Période trop courte" apparaît.
- Save avec template ≠ custom → le macrocycle créé a `templateId` persisté + phases générées + `mesocycle_weeks` peuplées (via `regenerateWeeks` automatique).
- Save avec template = custom → comportement B inchangé (macro vide).
