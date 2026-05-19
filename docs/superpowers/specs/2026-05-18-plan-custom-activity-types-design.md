# Spec — Types d'activité custom utilisables dans les fiches séance (Plan tab)

> **Status:** Spec validée — implémentation pas encore commencée
> **Périmètre strict :** onglet Plan uniquement. Aucun fichier dans `lib/activities/`, `intensity.ts`, ou la stack Activités n'est touché.

## Goal

Permettre à un athlète qui crée un type d'activité personnalisé (via ⚙ Personnalisé dans la bibliothèque) de l'utiliser comme **type** dans le dropdown du formulaire séance / template, avec un comportement cohérent dans tout le bloc Plan (filtres bibliothèque, totaux semaine, calendrier).

## Problème actuel

Le dropdown « Type » dans `SessionEditorModal` et `TemplateEditorModal` lit `TYPE_OPTIONS` — une liste **hardcodée** des 12 slugs de l'enum `SessionType`. Le catalogue `activity_types` (qui alimente les pills filtre) n'est pas connecté. Conséquence : un athlète qui crée un type custom "Tennis" voit un pill filtre apparaître dans la bibliothèque mais ne peut pas créer de séance "Tennis" — son type est invisible dans le dropdown.

Le typage `session.type: SessionType` (union fermée) empêche aussi de stocker un slug custom dans une séance.

## Approche retenue (A) — `SessionType = string` + resolver

`SessionType` devient `string`. Toute la logique qui dépendait de la fermeture de l'union (couleurs, labels, `isRunningType`) passe par un nouveau **resolver** unique qui consulte le catalogue `activity_types`.

Pas de migration SQL nécessaire au-delà de la 019 déjà appliquée.

### Pourquoi pas une union discriminée ?

Une union `BuiltinSessionType | { type: 'custom', slug: string }` aurait préservé l'exhaustivité TS sur les switches, au prix de :
- Plumbing dans chaque consommateur (`if type === 'custom' resolver(customSlug) else SESSION_TYPE_COLORS[type]`)
- Un état invalide possible (`customSlug` set quand type ≠ 'custom')

L'approche resolver-only est plus simple à maintenir et localise tout le branchement dans une seule fonction.

## Data model

### Type `SessionType` (`web/types/plan.ts`)

```ts
// AVANT
export type SessionType = 'course' | 'sortie_longue' | ... | 'musculation'

// APRÈS
export type SessionType = string

export const BUILTIN_SESSION_TYPES = [
  'course', 'sortie_longue', 'fractionne', 'seuil_tempo', 'cotes',
  'runtaf', 'velotaf', 'footing', 'velo', 'natation', 'renfo', 'musculation',
] as const

export type BuiltinSessionType = typeof BUILTIN_SESSION_TYPES[number]

export function isBuiltinSessionType(t: string): t is BuiltinSessionType {
  return (BUILTIN_SESSION_TYPES as readonly string[]).includes(t)
}
```

`PlannedSession.type` et `SessionTemplate.type` héritent automatiquement de `SessionType = string`.

### Nouveau helper `lib/plan/session-meta.ts`

```ts
import type { ActivityType } from '@/types/activity-types'
import type { IntensityLevel, SessionType } from '@/types/plan'
import { SESSION_TYPE_COLORS, SESSION_TYPE_LABELS } from '@/lib/activities/indicators'
import { isBuiltinSessionType } from '@/types/plan'

export type SessionCategory = 'run' | 'bike' | 'swim' | 'other'

export interface SessionMeta {
  label: string
  color: string            // hex
  category: SessionCategory
  isRunning: boolean       // == category === 'run'
  defaultIntensity: IntensityLevel
}

const FALLBACK_COLOR = '#6B7280'

// Map builtin → category (extraction depuis les sets de type-helpers.ts).
const BUILTIN_CATEGORY: Record<string, SessionCategory> = {
  course: 'run', sortie_longue: 'run', fractionne: 'run',
  seuil_tempo: 'run', cotes: 'run', footing: 'run', runtaf: 'run',
  velo: 'bike', velotaf: 'bike',
  natation: 'swim',
  renfo: 'other', musculation: 'other',
}

// Intensité par défaut pour les builtins (extrait des SESSION_TEMPLATES).
const BUILTIN_DEFAULT_INTENSITY: Record<string, IntensityLevel> = {
  course: 4, sortie_longue: 2, fractionne: 5, seuil_tempo: 4, cotes: 3,
  footing: 2, runtaf: 2, velotaf: 2, velo: 2, natation: 2,
  renfo: 1, musculation: 1,
}

export function resolveSessionMeta(
  type: SessionType,
  catalog: ActivityType[],
): SessionMeta {
  // 1. Builtin connu → SESSION_TYPE_COLORS/LABELS + maps locales
  if (isBuiltinSessionType(type)) {
    return {
      label: SESSION_TYPE_LABELS[type],
      color: SESSION_TYPE_COLORS[type],
      category: BUILTIN_CATEGORY[type],
      isRunning: BUILTIN_CATEGORY[type] === 'run',
      defaultIntensity: BUILTIN_DEFAULT_INTENSITY[type] ?? 2,
    }
  }

  // 2. Slug custom présent dans le catalogue
  const custom = catalog.find(t => t.slug === type)
  if (custom) {
    const cat = (custom.category ?? 'other') as SessionCategory
    return {
      label: custom.label,
      color: FALLBACK_COLOR,        // gris uniforme pour les customs
      category: cat,
      isRunning: cat === 'run',
      defaultIntensity: custom.defaultIntensity,
    }
  }

  // 3. Slug orphelin (type custom supprimé par l'user, mais séance toujours en base)
  return {
    label: type,
    color: FALLBACK_COLOR,
    category: 'other',
    isRunning: false,
    defaultIntensity: 2,
  }
}
```

### Sort de `lib/plan/type-helpers.ts`

`isRunningType`, `isBikeType`, `estimateDurationMin`, `getDefaultIntensityMode` sont **conservés inchangés** : ils opèrent sur les builtins uniquement et restent valides pour les usages no-catalog (SSR initial, tests unitaires de helpers, jest sans mock catalogue). Tous les consommateurs UI passent au resolver.

## UI changes

### 1. ActivityTypesPrefsModal — sélecteur catégorie

Dans le formulaire « Créer un type d'activité » (déjà existant) :

- Nouveau champ **Catégorie** entre `Nom` et `Intensité par défaut`
- 4 boutons radio : Run, Vélo, Natation, Autre (default = Other)
- Helper text : « La catégorie détermine si la séance compte dans les bulles km / D+ / durée du bloc Semaine (running uniquement). »
- Le state local `newCategory: SessionCategory` est passé à `onCreateCustom({ ..., category })`
- Suppression de la ligne `category: 'other'` hardcodée dans `addCustom()`

Dans la **liste des types** (vue glisser-déposer) :
- Affichage d'un petit badge `RUN/BIKE/SWIM/OTHER` à côté du label, calé sur `activityType.category`

### 2. SessionEditorModal & TemplateEditorModal — dropdown alimenté par catalogue

Remplacer la source du dropdown :

```tsx
// AVANT
const TYPE_OPTIONS: SessionType[] = ['sortie_longue', ..., 'musculation']
// usage :
{TYPE_OPTIONS.map(t => <option value={t}>{SESSION_TYPE_LABELS[t]}</option>)}

// APRÈS
const { visibleTypes } = useActivityTypes()
// usage : <optgroup> par catégorie
{groupByCategory(visibleTypes).map(([cat, types]) =>
  <optgroup label={CATEGORY_LABELS[cat]}>
    {types.map(t => <option value={t.slug}>{t.label}</option>)}
  </optgroup>
)}
```

Comportement détaillé :
- Le dropdown affiche **uniquement les types visibles** (cohérent avec les pills filtre — l'athlète qui a masqué `Velotaf` ne le voit pas non plus ici)
- Ordre des `<optgroup>` : Run → Bike → Swim → Other
- Quand l'athlète sélectionne un type, l'`intensity` du draft est mise à jour avec `meta.defaultIntensity` (déjà fait pour les builtins via `getDefaultIntensityForType` — remplacé par `resolveSessionMeta(nextType, catalog).defaultIntensity`)

### 3. Toggle Intensité/Allure

Composants impactés :
- `web/components/plan/IntensityPaceToggle.tsx` — composant feuille (le toggle lui-même). Ajout d'une prop `disabled?: boolean` qui :
  - grise le bouton "Allure"
  - force la valeur courante à `'level'` au mount si `disabled && current === 'pace'`
  - bloque le clic sur "Allure"
- `web/components/plan/RepeatStepEditor.tsx` et `web/components/plan/RepeatZoneCard.tsx` — passent `disabled = !meta.isRunning` au toggle
- `SessionEditorModal.tsx` / `TemplateEditorModal.tsx` — pour les zones simples (sans bloc Répéter), même prop passée

Helper text contextuel sous le toggle quand `disabled` : `Catégorie "${categoryLabel}" → niveau uniquement.`

Si l'athlète **change** le type de la séance et passe d'un type running à un type non-running alors qu'une étape était en mode `'pace'` : on coerce automatiquement les `mode` des étapes à `'level'` dans le draft, silencieusement. Implémenté dans le handler `onChange` du `<select>` Type des deux modales.

### 4. Calendrier (`DraggableSessionCard` dans `VueSemaineBlock`)

- La **bordure de couleur** utilise déjà `INTENSITY_LEVEL_COLORS[session.intensity]` — inchangée
- L'**affichage du label type** (déjà via `SESSION_TYPE_LABELS[s.type]` en majuscules au-dessus du titre) passe à `resolveSessionMeta(s.type, catalog).label`. Pour un type orphelin (slug supprimé), on affiche le slug brut au lieu de crasher.
- Les **km en orange** restent affichés pour toute séance avec `distance > 0`, indépendamment du type

### 5. Filtres bibliothèque

Aucun changement : les pills filtre lisent déjà `visibleTypes` du catalogue. Le filtre `t.type === selectedType` fonctionne directement avec les slugs custom une fois que `session.type` peut contenir un slug custom.

### 6. Bloc Semaine — totaux

Le calcul `isRunningType(s.type)` dans `VueSemaineBlock.totals` est remplacé par `resolveSessionMeta(s.type, catalog).isRunning`. Un nouveau hook `useActivityTypes()` est consommé dans `VueSemaineBlock` (pattern déjà utilisé dans `BibliothequeSeancesBlock`).

`estimateDurationMin(s.type, s.distance)` devient `estimateDurationMinFromMeta(meta, s.distance)` — même formule (6 min/km running, 3 min/km bike) mais consulte la catégorie résolue au lieu de l'enum.

## Compatibilité avec données existantes

### Séances avec slug builtin (cas standard)
Aucun impact — le resolver retourne les mêmes valeurs qu'avant.

### Séances avec slug custom orphelin
Si un athlète a créé un type custom, planifié une séance, puis supprimé le type custom : la séance reste en base avec un slug qui n'est ni builtin ni dans le catalogue.

→ Le resolver branche sur le path "orphelin" et retourne `{ label: slug, color: gris, category: 'other', isRunning: false }`. L'athlète peut éditer la séance pour changer son type, ou la supprimer.

### Migration des séances orphelines existantes
Pas de migration automatique. L'athlète est notre cas d'usage actuel (1 user) et son cas concret — la séance `Runtaf Coulée verte A/R` créée avec un slug `runtaf-<timestamp>` — peut être réglée manuellement via édition de la séance pour passer le type au système `runtaf` (maintenant disponible suite à la mig 019).

## Testing

### Tests unitaires nouveaux
- `__tests__/lib/plan/session-meta.test.ts`
  - Builtin connu (footing) → couleur verte, isRunning=true, category='run'
  - Custom dans catalogue → couleur grise, isRunning calculé depuis category
  - Slug orphelin → fallback no-crash
  - Catégorie 'bike' → isRunning=false, color gris

### Tests existants à mettre à jour
- `__tests__/components/plan/BibliothequeSeancesBlock.test.tsx` — vérifier que le filtre custom matche les séances créées avec ce type
- `__tests__/components/plan/VueSemaineBlock.test.tsx` (s'il existe) — vérifier que les totaux excluent une séance de type custom catégorie 'other'

### Pas de test E2E nouveau
Le flux complet (créer type custom → planifier séance → vérifier dans bibliothèque + calendrier) sera testé manuellement par Franck. Pas d'automation Playwright pour ce flow — la couverture unitaire du resolver + les tests de composants existants suffisent.

## Non-objectifs (YAGNI)

- ❌ **Couleur custom au choix de l'athlète** : gris uniforme. Si demande futur, on ajoutera un color picker.
- ❌ **Migration des séances orphelines** : trop peu de volume pour justifier un job. L'utilisateur les corrige à la main si besoin.
- ❌ **Synchronisation avec les types d'activité de l'onglet Activités** : les 2 catalogues restent indépendants. Le Plan a son propre vocabulaire.
- ❌ **Icônes par catégorie ou type custom** : le label texte suffit.

## Décisions UX

| Sujet | Choix |
|---|---|
| Couleur des customs | Gris uniforme `#6B7280` |
| Couleur des km (mini-card calendrier) | Orange pour tous les types, indépendamment de la couleur du type — le sémantisme "orange = km" reste constant |
| Catégorie par défaut à la création | `other` (l'athlète doit explicitement choisir `run` pour que ça compte dans les totaux) |
| Coercition mode allure → niveau | Automatique au changement de type (silencieux, pas de confirmation) |
| Type orphelin (slug supprimé) | Affichage du slug brut, pas de message d'erreur |

## Files touched

- `web/types/plan.ts` — `SessionType` devient `string` + constantes builtins
- `web/lib/plan/session-meta.ts` — **nouveau** (resolver + types)
- `web/lib/plan/type-helpers.ts` — inchangé (helpers builtins-only conservés)
- `web/components/plan/ActivityTypesPrefsModal.tsx` — sélecteur catégorie + badge dans liste
- `web/components/plan/SessionEditorModal.tsx` — dropdown depuis catalogue + resolver pour intensity default
- `web/components/plan/TemplateEditorModal.tsx` — idem
- `web/components/plan/VueSemaineBlock.tsx` — totaux via resolver + label via resolver
- `web/components/plan/BibliothequeSeancesBlock.tsx` — `SESSION_TYPE_LABELS[template.type]` remplacé par resolver pour les cards
- `web/components/plan/IntensityPaceToggle.tsx` — prop `disabled` ajoutée
- `web/components/plan/RepeatStepEditor.tsx` et `RepeatZoneCard.tsx` — propagation `disabled` depuis `meta.isRunning`
- `web/__tests__/lib/plan/session-meta.test.ts` — **nouveau**
