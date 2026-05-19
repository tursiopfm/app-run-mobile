# Plan-tab Custom Activity Types — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux types d'activité custom (créés via ⚙ Personnalisé) d'être sélectionnables comme `type` dans le formulaire séance/template, avec catégorie (run/bike/swim/other) choisie à la création et comportement cohérent dans tout le bloc Plan.

**Architecture:** Approche A — découpler `SessionType` (Plan) de `WorkoutType` (Activités) ; `SessionType` devient `string` libre ; nouveau resolver `resolveSessionMeta(type, catalog)` centralise le branchement builtin vs custom vs orphelin. Le toggle Intensité/Allure est désactivé hors `category === 'run'`.

**Tech Stack:** TypeScript strict, Next.js 14 App Router, Jest + React Testing Library, Tailwind, Supabase (read-only — aucune migration SQL).

**Périmètre strict :** onglet Plan uniquement. Aucun fichier dans `web/lib/activities/`, `web/types/activity.ts`, ou `web/lib/activities/intensity.ts` n'est touché.

---

## Pré-requis

- Branche dédiée : `feat/plan-custom-activity-types` (créée depuis `master`)
- Confirmer que le typecheck baseline passe avant de commencer : `cd web && npx tsc --noEmit` → 0 erreur.

---

## File Structure

**Nouveaux fichiers :**
- `web/lib/plan/session-meta.ts` — resolver + constantes builtin (category / intensity par slug)
- `web/__tests__/lib/plan/session-meta.test.ts` — tests unitaires du resolver

**Fichiers modifiés :**
- `web/types/plan.ts` — `SessionType` découplé de `WorkoutType`, devient `string` ; export `BUILTIN_SESSION_TYPES`
- `web/components/plan/IntensityPaceToggle.tsx` — ajout prop `disabled`
- `web/components/plan/ActivityTypesPrefsModal.tsx` — sélecteur catégorie + badge dans la liste
- `web/components/plan/SessionEditorModal.tsx` — dropdown depuis catalogue + coercition mode
- `web/components/plan/TemplateEditorModal.tsx` — idem
- `web/components/plan/RepeatStepEditor.tsx` — propagation `disabled`
- `web/components/plan/RepeatZoneCard.tsx` — propagation `disabled`
- `web/components/plan/VueSemaineBlock.tsx` — totaux + label DraggableSessionCard via resolver
- `web/components/plan/BibliothequeSeancesBlock.tsx` — TemplateCard label via resolver
- `web/lib/plan/type-helpers.ts` — **inchangé** (helpers builtins-only conservés pour SSR/jest)

---

### Task 1: Découpler SessionType de WorkoutType, exporter les builtins

**Files:**
- Modify: `web/types/plan.ts:1-9`

- [ ] **Step 1: Modifier la définition de `SessionType`**

Remplacer lignes 1-9 par :

```ts
// Types pour l'onglet Plan (mode Manuel).
// SessionType est libre (string) pour accepter les slugs custom du catalogue
// activity_types. Les 12 builtins sont listés dans BUILTIN_SESSION_TYPES.
// WorkoutType (lib/activities/intensity.ts) reste l'enum fermé côté Activités.

import type { IntensityLevel } from '@/lib/activities/indicators'

export type SessionType = string

export const BUILTIN_SESSION_TYPES = [
  'course',
  'sortie_longue',
  'fractionne',
  'seuil_tempo',
  'cotes',
  'runtaf',
  'velotaf',
  'footing',
  'velo',
  'natation',
  'renfo',
  'musculation',
] as const

export type BuiltinSessionType = typeof BUILTIN_SESSION_TYPES[number]

export function isBuiltinSessionType(t: string): t is BuiltinSessionType {
  return (BUILTIN_SESSION_TYPES as readonly string[]).includes(t)
}

export type { IntensityLevel }
```

- [ ] **Step 2: Lancer le typecheck pour repérer les régressions**

Run: `cd web && npx tsc --noEmit 2>&1 | head -50`

Expected: 0 erreur. `SessionType` étant maintenant un `string`, tout assignement de `WorkoutType` vers `SessionType` reste valide (subset) et l'inverse n'arrive pas dans le code Plan.

Si des erreurs apparaissent — typiquement dans `SessionEditorModal.tsx` ou `TemplateEditorModal.tsx` à cause des casts implicites — c'est normal, elles seront résolues dans les tâches suivantes. **Ne pas patcher en mode "as WorkoutType"** : note l'erreur et passe à Task 2.

- [ ] **Step 3: Commit**

```bash
git add web/types/plan.ts
git commit -m "refactor(plan): SessionType devient string libre + exporter BUILTIN_SESSION_TYPES"
```

---

### Task 2: Resolver `session-meta.ts` (TDD)

**Files:**
- Create: `web/lib/plan/session-meta.ts`
- Create: `web/__tests__/lib/plan/session-meta.test.ts`

- [ ] **Step 1: Écrire les tests qui doivent échouer**

Créer `web/__tests__/lib/plan/session-meta.test.ts` :

```ts
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import type { ActivityType } from '@/types/activity-types'

const customRun: ActivityType = {
  id: 'c-1',
  slug: 'trail-race-xyz',
  label: 'Trail Race',
  defaultIntensity: 3,
  category: 'run',
  isSystem: false,
}

const customOther: ActivityType = {
  id: 'c-2',
  slug: 'tennis-abc',
  label: 'Tennis',
  defaultIntensity: 2,
  category: 'other',
  isSystem: false,
}

const catalog: ActivityType[] = [customRun, customOther]

describe('resolveSessionMeta', () => {
  it('builtin running type → couleur enum + isRunning=true', () => {
    const meta = resolveSessionMeta('footing', catalog)
    expect(meta.label).toBe('Endurance Fondamentale')
    expect(meta.color).toBe('#4ADE80')
    expect(meta.category).toBe('run')
    expect(meta.isRunning).toBe(true)
    expect(meta.defaultIntensity).toBe(2)
  })

  it('builtin bike type → category=bike, isRunning=false', () => {
    const meta = resolveSessionMeta('velo', catalog)
    expect(meta.category).toBe('bike')
    expect(meta.isRunning).toBe(false)
  })

  it('custom run → label catalog, couleur grise, isRunning=true', () => {
    const meta = resolveSessionMeta('trail-race-xyz', catalog)
    expect(meta.label).toBe('Trail Race')
    expect(meta.color).toBe('#6B7280')
    expect(meta.category).toBe('run')
    expect(meta.isRunning).toBe(true)
    expect(meta.defaultIntensity).toBe(3)
  })

  it('custom other → isRunning=false', () => {
    const meta = resolveSessionMeta('tennis-abc', catalog)
    expect(meta.isRunning).toBe(false)
    expect(meta.color).toBe('#6B7280')
  })

  it('slug orphelin (ni builtin ni catalogue) → fallback no-crash', () => {
    const meta = resolveSessionMeta('zombie-slug-123', catalog)
    expect(meta.label).toBe('zombie-slug-123')
    expect(meta.color).toBe('#6B7280')
    expect(meta.category).toBe('other')
    expect(meta.isRunning).toBe(false)
    expect(meta.defaultIntensity).toBe(2)
  })

  it('catalogue vide → builtins restent OK', () => {
    const meta = resolveSessionMeta('footing', [])
    expect(meta.isRunning).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd web && npx jest __tests__/lib/plan/session-meta.test.ts`
Expected: FAIL — `Cannot find module '@/lib/plan/session-meta'`

- [ ] **Step 3: Créer le resolver**

Créer `web/lib/plan/session-meta.ts` :

```ts
import type { ActivityType } from '@/types/activity-types'
import { isBuiltinSessionType, type IntensityLevel, type SessionType } from '@/types/plan'
import { SESSION_TYPE_COLORS, SESSION_TYPE_LABELS } from '@/lib/activities/indicators'

export type SessionCategory = 'run' | 'bike' | 'swim' | 'other'

export interface SessionMeta {
  label: string
  color: string
  category: SessionCategory
  isRunning: boolean
  defaultIntensity: IntensityLevel
}

const FALLBACK_COLOR = '#6B7280'

const BUILTIN_CATEGORY: Record<string, SessionCategory> = {
  course: 'run',
  sortie_longue: 'run',
  fractionne: 'run',
  seuil_tempo: 'run',
  cotes: 'run',
  footing: 'run',
  runtaf: 'run',
  velo: 'bike',
  velotaf: 'bike',
  natation: 'swim',
  renfo: 'other',
  musculation: 'other',
}

const BUILTIN_DEFAULT_INTENSITY: Record<string, IntensityLevel> = {
  course: 4,
  sortie_longue: 2,
  fractionne: 5,
  seuil_tempo: 4,
  cotes: 3,
  footing: 2,
  runtaf: 2,
  velotaf: 2,
  velo: 2,
  natation: 2,
  renfo: 1,
  musculation: 1,
}

export function resolveSessionMeta(
  type: SessionType,
  catalog: ActivityType[],
): SessionMeta {
  if (isBuiltinSessionType(type)) {
    const cat = BUILTIN_CATEGORY[type]
    return {
      label: SESSION_TYPE_LABELS[type as keyof typeof SESSION_TYPE_LABELS],
      color: SESSION_TYPE_COLORS[type as keyof typeof SESSION_TYPE_COLORS],
      category: cat,
      isRunning: cat === 'run',
      defaultIntensity: BUILTIN_DEFAULT_INTENSITY[type] ?? 2,
    }
  }

  const custom = catalog.find(t => t.slug === type)
  if (custom) {
    const cat = (custom.category ?? 'other') as SessionCategory
    return {
      label: custom.label,
      color: FALLBACK_COLOR,
      category: cat,
      isRunning: cat === 'run',
      defaultIntensity: custom.defaultIntensity,
    }
  }

  return {
    label: type,
    color: FALLBACK_COLOR,
    category: 'other',
    isRunning: false,
    defaultIntensity: 2,
  }
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `cd web && npx jest __tests__/lib/plan/session-meta.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add web/lib/plan/session-meta.ts web/__tests__/lib/plan/session-meta.test.ts
git commit -m "feat(plan): resolver session-meta.ts (builtin/custom/orphan) + tests"
```

---

### Task 3: ActivityTypesPrefsModal — sélecteur catégorie + badge

**Files:**
- Modify: `web/components/plan/ActivityTypesPrefsModal.tsx`

- [ ] **Step 1: Lire l'état actuel du formulaire de création**

Ouvre `web/components/plan/ActivityTypesPrefsModal.tsx` et identifie la zone qui contient `newLabel` et `newIntensity` (autour des lignes 49-50 et 72-85). C'est là qu'il faut insérer le champ catégorie.

- [ ] **Step 2: Ajouter le state local `newCategory`**

Près de `const [newIntensity, setNewIntensity] = useState<IntensityLevel>(2)` ajouter :

```ts
import type { ActivityType, UserActivityPref } from '@/types/activity-types'
// ... (existant)
const [newCategory, setNewCategory] = useState<NonNullable<ActivityType['category']>>('other')
```

- [ ] **Step 3: Brancher `newCategory` sur `onCreateCustom`**

Remplacer le contenu de `addCustom()` :

```ts
async function addCustom() {
  const label = newLabel.trim()
  if (!label) return
  const slug = slugify(label) + '-' + Date.now().toString(36)
  const created = await onCreateCustom({
    slug,
    label,
    defaultIntensity: newIntensity,
    category: newCategory,
  })
  setDrafts([...drafts, { slug: created.slug, label: created.label, isVisible: true, type: created }])
  setNewLabel('')
  setNewIntensity(2)
  setNewCategory('other')
}
```

- [ ] **Step 4: Ajouter le sélecteur catégorie dans le formulaire (JSX)**

Repérer le bloc JSX qui contient l'input du label et le slider d'intensité du formulaire de création (cherche `newLabel` dans le JSX). Insérer le bloc suivant **entre** le champ Label et le champ Intensité par défaut :

```tsx
<div>
  <label className="block text-[11px] font-semibold text-trail-muted uppercase tracking-wider mb-1.5">
    Catégorie
  </label>
  <div className="grid grid-cols-4 gap-1.5">
    {(['run', 'bike', 'swim', 'other'] as const).map(c => {
      const labels: Record<typeof c, string> = { run: 'Run', bike: 'Vélo', swim: 'Natation', other: 'Autre' }
      const checked = newCategory === c
      return (
        <button
          key={c}
          type="button"
          onClick={() => setNewCategory(c)}
          className={
            'text-center py-2 px-1 rounded-[8px] text-[12px] font-semibold border ' +
            (checked
              ? 'border-trail-primary bg-trail-primary/10 text-trail-primary'
              : 'border-trail-border bg-trail-surface text-trail-muted hover:text-trail-text')
          }
        >
          {labels[c]}
        </button>
      )
    })}
  </div>
  <p className="mt-1.5 text-[11px] text-trail-muted italic">
    Détermine si la séance compte dans les bulles km / D+ / durée du bloc Semaine (running uniquement).
  </p>
</div>
```

- [ ] **Step 5: Ajouter le badge catégorie dans la liste**

Localiser le rendu de la `type-row` (ligne où on affiche `d.label`). Ajouter à droite du label, **avant** le toggle visibilité, un badge :

```tsx
{d.type.category && (
  <span className="text-[10px] px-1.5 py-[2px] rounded bg-trail-surface border border-trail-border text-trail-muted uppercase tracking-wider">
    {d.type.category === 'run' ? 'RUN' : d.type.category === 'bike' ? 'BIKE' : d.type.category === 'swim' ? 'SWIM' : 'OTHER'}
  </span>
)}
```

- [ ] **Step 6: Vérifier typecheck + lint**

Run: `cd web && npx tsc --noEmit && npx next lint --dir components/plan`
Expected: 0 erreur, 0 warning.

- [ ] **Step 7: Test manuel rapide**

Lancer `npm run dev`, naviguer vers `/plan`, ouvrir le bloc Bibliothèque → cliquer "⚙ Personnalisé". Vérifier :
- Le bloc Catégorie est visible avec 4 boutons radio, "Autre" sélectionné par défaut
- Créer un type "Test Run" avec catégorie "Run" — il apparaît dans la liste avec badge `RUN`
- Le helper text est lisible

- [ ] **Step 8: Commit**

```bash
git add web/components/plan/ActivityTypesPrefsModal.tsx
git commit -m "feat(plan): sélecteur catégorie + badge dans ActivityTypesPrefsModal"
```

---

### Task 4: SessionEditorModal — dropdown depuis catalogue

**Files:**
- Modify: `web/components/plan/SessionEditorModal.tsx`

- [ ] **Step 1: Importer le hook catalog + resolver**

En tête de fichier (parmi les imports existants) ajouter :

```ts
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { resolveSessionMeta, type SessionCategory } from '@/lib/plan/session-meta'
```

- [ ] **Step 2: Consommer le catalogue dans le composant principal**

Dans le corps de `SessionEditorModal` (composant principal, pas le sub-component qui prend `draft`), récupérer `visibleTypes` :

```ts
const { visibleTypes, types } = useActivityTypes()
```

Puis transmettre `visibleTypes` et `types` au sub-component qui affiche le dropdown (probablement nommé quelque chose comme `SimpleEditor` ou `BasicFields`). Cherche le composant qui contient le `<select value={draft.type}>` et ajoute ces deux props.

- [ ] **Step 3: Remplacer la source du dropdown**

Dans le sub-component qui contient le `<select>` (cherche `value={draft.type}` autour de la ligne 350), remplacer le bloc :

```tsx
<select value={draft.type} onChange={...}>
  {TYPE_OPTIONS.map(t => (
    <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>
  ))}
</select>
```

par :

```tsx
<select
  value={draft.type}
  onChange={e => {
    const nextType = e.target.value
    const nextMeta = resolveSessionMeta(nextType, types)
    setDraft({
      ...draft,
      type: nextType,
      intensity: nextMeta.defaultIntensity,
      // Coercition silencieuse : si le nouveau type n'est pas running et
      // qu'une zone est en mode 'pace', la repasser en 'level'
      zones: draft.zones?.map(z =>
        !nextMeta.isRunning && z.intensityMode === 'pace'
          ? { ...z, intensityMode: 'level' }
          : z
      ),
    })
  }}
  className="flex-1 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
>
  {(['run', 'bike', 'swim', 'other'] as const).map(cat => {
    const optionsInCat = visibleTypes.filter(t => (t.category ?? 'other') === cat)
    if (optionsInCat.length === 0) return null
    const labels: Record<typeof cat, string> = {
      run: 'Course à pied', bike: 'Vélo', swim: 'Natation', other: 'Autre',
    }
    return (
      <optgroup key={cat} label={labels[cat]}>
        {optionsInCat.map(t => (
          <option key={t.slug} value={t.slug}>{t.label}</option>
        ))}
      </optgroup>
    )
  })}
</select>
```

⚠️ Le `setDraft` ci-dessus n'inclut plus l'ancien `getDefaultIntensityForType` — c'est volontaire, le resolver le remplace. Vérifier si `getDefaultIntensityForType` reste utilisé ailleurs dans le fichier ; si non, supprimer son import et sa définition.

- [ ] **Step 4: Supprimer la constante `TYPE_OPTIONS`**

Lignes ~60-63 :

```ts
const TYPE_OPTIONS: SessionType[] = [
  'sortie_longue', 'fractionne', ..., 'musculation',
]
```

À supprimer entièrement.

- [ ] **Step 5: Adapter `SESSION_TYPE_LABELS[draft.type]` partout**

Cherche dans le fichier toutes les occurrences de `SESSION_TYPE_LABELS[` ou `SESSION_TYPE_COLORS[`. Pour chacune, remplacer par `resolveSessionMeta(draft.type, types).label` (ou `.color`).

Si une occurrence se trouve dans un sub-component, lui passer `types` en prop ou y faire `useActivityTypes()` à condition que ce sub soit aussi un composant React (pas une fonction utilitaire).

- [ ] **Step 6: Vérifier typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 7: Test manuel**

`npm run dev` → ouvrir une séance existante → vérifier :
- Le dropdown liste les builtins par groupes Course à pied / Vélo / Natation / Autre
- Sélectionner un type custom (créé en Task 3) → l'intensité par défaut change
- Sélectionner un type non-running → si la séance avait une zone en mode allure, elle bascule en niveau (vérifie après save+reload)

- [ ] **Step 8: Commit**

```bash
git add web/components/plan/SessionEditorModal.tsx
git commit -m "feat(plan): SessionEditorModal - dropdown depuis catalogue + coercition mode allure"
```

---

### Task 5: TemplateEditorModal — dropdown depuis catalogue

**Files:**
- Modify: `web/components/plan/TemplateEditorModal.tsx`

- [ ] **Step 1: Importer hook + resolver**

En tête de fichier (parmi les imports existants) ajouter :

```ts
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
```

- [ ] **Step 2: Consommer le catalogue dans le composant principal**

Dans `TemplateEditorModal` (composant principal) ajouter :

```ts
const { visibleTypes, types } = useActivityTypes()
```

Transmettre `visibleTypes` et `types` au sub-component qui contient le `<select value={draft.type}>` (autour de la ligne ~340).

- [ ] **Step 3: Remplacer le `<select>`**

Dans le sub-component qui contient le dropdown, remplacer :

```tsx
<select value={draft.type} onChange={...}>
  {TYPE_OPTIONS.map(t => (
    <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>
  ))}
</select>
```

par (identique au pattern Task 4 — vérifier le nom des champs du draft template, qui peut différer de `zones` ; adapter au schéma `SessionTemplate`) :

```tsx
<select
  value={draft.type}
  onChange={e => {
    const nextType = e.target.value
    const nextMeta = resolveSessionMeta(nextType, types)
    setDraft({
      ...draft,
      type: nextType,
      defaultIntensity: nextMeta.defaultIntensity,
      // Si la structure du draft contient des zones avec intensityMode,
      // coercer pace → level pour les types non-running
      defaultStructure: draft.defaultStructure?.map(z =>
        !nextMeta.isRunning && z.intensityMode === 'pace'
          ? { ...z, intensityMode: 'level' }
          : z
      ),
    })
  }}
  className="flex-1 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
>
  {(['run', 'bike', 'swim', 'other'] as const).map(cat => {
    const optionsInCat = visibleTypes.filter(t => (t.category ?? 'other') === cat)
    if (optionsInCat.length === 0) return null
    const labels: Record<typeof cat, string> = {
      run: 'Course à pied', bike: 'Vélo', swim: 'Natation', other: 'Autre',
    }
    return (
      <optgroup key={cat} label={labels[cat]}>
        {optionsInCat.map(t => (
          <option key={t.slug} value={t.slug}>{t.label}</option>
        ))}
      </optgroup>
    )
  })}
</select>
```

⚠️ Si `SessionTemplate` n'utilise pas `defaultStructure` mais un autre champ (ex : `zones`), adapter le nom dans le `.map()`. Si la coercition n'est pas nécessaire (template sans structure d'étapes), retirer le bloc `defaultStructure: ...`.

- [ ] **Step 4: Supprimer la constante `TYPE_OPTIONS`**

Lignes ~60-63 :

```ts
const TYPE_OPTIONS: SessionType[] = [
  'sortie_longue', 'fractionne', ..., 'musculation',
]
```

À supprimer entièrement.

- [ ] **Step 5: Remplacer `SESSION_TYPE_LABELS[` / `SESSION_TYPE_COLORS[`**

Cherche dans le fichier toutes les occurrences de `SESSION_TYPE_LABELS[` ou `SESSION_TYPE_COLORS[`. Pour chacune, remplacer par `resolveSessionMeta(draft.type, types).label` (ou `.color`). Si l'occurrence est dans un sub-component, passer `types` en prop depuis le parent.

- [ ] **Step 6: Vérifier typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 7: Test manuel**

`npm run dev` → Bibliothèque → ouvrir un template existant → vérifier dropdown groupé + sélection d'un custom met à jour l'intensité par défaut.

- [ ] **Step 8: Commit**

```bash
git add web/components/plan/TemplateEditorModal.tsx
git commit -m "feat(plan): TemplateEditorModal - dropdown depuis catalogue + coercition mode allure"
```

---

### Task 6: IntensityPaceToggle — prop `disabled` (TDD)

**Files:**
- Modify: `web/components/plan/IntensityPaceToggle.tsx`
- Create: `web/__tests__/components/plan/IntensityPaceToggle.test.tsx`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `web/__tests__/components/plan/IntensityPaceToggle.test.tsx` :

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { IntensityPaceToggle } from '@/components/plan/IntensityPaceToggle'

describe('IntensityPaceToggle', () => {
  it('disabled=true : bouton Allure grisé et non cliquable', () => {
    const onChange = jest.fn()
    render(<IntensityPaceToggle value="level" onChange={onChange} disabled />)
    const pace = screen.getByRole('tab', { name: 'Allure' })
    expect(pace).toBeDisabled()
    fireEvent.click(pace)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disabled=true + value="pace" : appelle onChange("level") au mount', () => {
    const onChange = jest.fn()
    render(<IntensityPaceToggle value="pace" onChange={onChange} disabled />)
    expect(onChange).toHaveBeenCalledWith('level')
  })

  it('disabled=false : Allure cliquable (comportement actuel)', () => {
    const onChange = jest.fn()
    render(<IntensityPaceToggle value="level" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Allure' }))
    expect(onChange).toHaveBeenCalledWith('pace')
  })
})
```

- [ ] **Step 2: Lancer le test — il échoue**

Run: `cd web && npx jest __tests__/components/plan/IntensityPaceToggle.test.tsx`
Expected: FAIL (prop disabled ignorée).

- [ ] **Step 3: Implémenter la prop**

Remplacer le contenu de `web/components/plan/IntensityPaceToggle.tsx` :

```tsx
'use client'

import { useEffect } from 'react'
import type { IntensityMode } from '@/types/plan'

type Props = {
  value: IntensityMode
  onChange: (mode: IntensityMode) => void
  size?: 'sm' | 'md'
  disabled?: boolean   // quand catégorie != 'run' : Allure désactivé, force 'level'
}

export function IntensityPaceToggle({ value, onChange, size = 'sm', disabled = false }: Props) {
  // Coercition automatique : si on devient disabled et value='pace', repasse en 'level'
  useEffect(() => {
    if (disabled && value === 'pace') onChange('level')
  }, [disabled, value, onChange])

  const sizeCls = size === 'sm' ? 'text-[11px] py-1 px-2' : 'text-[13px] py-1.5 px-3'

  return (
    <div
      className="inline-flex rounded-[8px] bg-trail-surface border border-trail-border overflow-hidden"
      role="tablist"
      aria-label="Mode d'intensité du segment"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'level'}
        onClick={() => onChange('level')}
        className={`${sizeCls} font-semibold transition-colors ${
          value === 'level'
            ? 'bg-trail-primary text-black'
            : 'text-trail-muted hover:text-trail-text'
        }`}
      >
        Intensité
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'pace'}
        onClick={() => !disabled && onChange('pace')}
        disabled={disabled}
        title={disabled ? 'Mode allure disponible uniquement pour les types running' : undefined}
        className={`${sizeCls} font-semibold transition-colors ${
          disabled
            ? 'text-trail-muted/40 cursor-not-allowed'
            : value === 'pace'
              ? 'bg-trail-primary text-black'
              : 'text-trail-muted hover:text-trail-text'
        }`}
      >
        Allure
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test — il passe**

Run: `cd web && npx jest __tests__/components/plan/IntensityPaceToggle.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add web/components/plan/IntensityPaceToggle.tsx web/__tests__/components/plan/IntensityPaceToggle.test.tsx
git commit -m "feat(plan): IntensityPaceToggle - prop disabled + coercition pace→level"
```

---

### Task 7: Propager `disabled` dans RepeatStepEditor / RepeatZoneCard

**Files:**
- Modify: `web/components/plan/RepeatStepEditor.tsx`
- Modify: `web/components/plan/RepeatZoneCard.tsx`

- [ ] **Step 1: Identifier le call site IntensityPaceToggle dans RepeatStepEditor**

Ouvre `web/components/plan/RepeatStepEditor.tsx`, cherche `<IntensityPaceToggle`. Ce composant reçoit déjà via ses props ou via context le `session.type` ? Si non, ajouter une nouvelle prop `intensityModeDisabled?: boolean` au composant et la passer au toggle :

```tsx
// Dans la signature du composant
type Props = {
  // ... props existantes
  intensityModeDisabled?: boolean
}

// Dans le JSX
<IntensityPaceToggle
  value={step.intensityMode}
  onChange={mode => onChange({ ...step, intensityMode: mode })}
  disabled={intensityModeDisabled}
/>
```

- [ ] **Step 2: Idem dans RepeatZoneCard**

Ouvre `web/components/plan/RepeatZoneCard.tsx`. Ajouter `intensityModeDisabled` aux props et le passer aux `<RepeatStepEditor>` enfants ainsi qu'au toggle du niveau zone si présent.

- [ ] **Step 3: Brancher la prop depuis SessionEditorModal et TemplateEditorModal**

Dans SessionEditorModal et TemplateEditorModal, là où `<RepeatZoneCard>` est rendu, calculer le flag :

```tsx
import { resolveSessionMeta } from '@/lib/plan/session-meta'
// ...
const meta = resolveSessionMeta(draft.type, types)
const intensityModeDisabled = !meta.isRunning

<RepeatZoneCard
  zone={zone}
  onChange={...}
  intensityModeDisabled={intensityModeDisabled}
/>
```

Idem pour les toggles directs (zones non-Répéter) — propager `disabled={intensityModeDisabled}` à chaque `<IntensityPaceToggle>` dans les deux modales.

- [ ] **Step 4: Vérifier typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 5: Test manuel**

`npm run dev` → créer une séance avec type "Vélo" et un bloc Répéter → vérifier que le bouton Allure est grisé sur chaque étape. Changer le type à "Footing" → le bouton se réactive.

- [ ] **Step 6: Commit**

```bash
git add web/components/plan/RepeatStepEditor.tsx web/components/plan/RepeatZoneCard.tsx web/components/plan/SessionEditorModal.tsx web/components/plan/TemplateEditorModal.tsx
git commit -m "feat(plan): propager disabled au toggle Intensité/Allure selon catégorie"
```

---

### Task 8: VueSemaineBlock — totaux + label via resolver

**Files:**
- Modify: `web/components/plan/VueSemaineBlock.tsx`

- [ ] **Step 1: Importer les nouveaux helpers**

Près des imports existants :

```ts
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
```

- [ ] **Step 2: Consommer le catalogue**

Dans le corps de `VueSemaineBlock` (après `const [weekStartISO, setWeekStartISO] = ...`) :

```ts
const { types } = useActivityTypes()
```

- [ ] **Step 3: Remplacer `isRunningType(s.type)` dans le calcul des totaux**

Repérer le `useMemo` qui calcule `totals` (cherche `Totaux semaine`). Remplacer :

```ts
const totals = useMemo(() => {
  let duration = 0, distance = 0, elevation = 0
  for (const s of sessions) {
    if (!isRunningType(s.type)) continue
    const dur = s.duration && s.duration > 0
      ? s.duration
      : estimateDurationMin(s.type, s.distance ?? 0)
    duration += dur
    distance += s.distance || 0
    elevation += s.elevation || 0
  }
  return { duration, distance, elevation }
}, [sessions])
```

par :

```ts
const totals = useMemo(() => {
  let duration = 0, distance = 0, elevation = 0
  for (const s of sessions) {
    const meta = resolveSessionMeta(s.type, types)
    if (!meta.isRunning) continue
    let dur = s.duration && s.duration > 0 ? s.duration : 0
    if (dur === 0 && s.distance && s.distance > 0) {
      // Extrapolation : running 6 min/km (couvre tous les types catégorie 'run')
      dur = s.distance * 6
    }
    duration += dur
    distance += s.distance || 0
    elevation += s.elevation || 0
  }
  return { duration, distance, elevation }
}, [sessions, types])
```

Note : `estimateDurationMin(s.type, s.distance)` ne fonctionne plus pour les customs (il check builtins-only). On hardcode 6 min/km ici puisqu'on est déjà dans la branche `isRunning`. Pour les types non-running (qui sont skip via `continue`), aucun calcul n'est fait — comportement identique à avant.

- [ ] **Step 4: Remplacer `SESSION_TYPE_LABELS[s.type]` dans DraggableSessionCard**

Cherche dans le composant `DraggableSessionCard` la ligne qui affiche le label en majuscules (typiquement `{SESSION_TYPE_LABELS[session.type]}`). Remplacer par :

```tsx
const meta = resolveSessionMeta(session.type, types)
// ...
<p className="text-[10px] font-semibold text-trail-muted uppercase tracking-wider">
  {meta.label}
</p>
```

Important : `DraggableSessionCard` est un sub-component. Il faut soit :
- (a) appeler `useActivityTypes()` à l'intérieur (chaque carte fait un appel — léger car le hook cache via état React, mais multiplie les rerenders)
- (b) passer `types` en prop depuis le parent (plus propre)

Choisis (b). Modifier la signature de `DraggableSessionCard` pour accepter `types: ActivityType[]`, et passer la valeur depuis le `.map()` parent.

- [ ] **Step 5: Vérifier typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 6: Test manuel**

Vérifier les bulles km/D+/durée affichent bien zéro si aucune séance running cette semaine. Créer une séance custom catégorie 'run' avec 10 km → la bulle km doit afficher 10 km, durée 60 min (10×6).

- [ ] **Step 7: Commit**

```bash
git add web/components/plan/VueSemaineBlock.tsx
git commit -m "feat(plan): VueSemaineBlock - totaux + label DraggableSessionCard via resolver"
```

---

### Task 9: BibliothequeSeancesBlock — TemplateCard label via resolver

**Files:**
- Modify: `web/components/plan/BibliothequeSeancesBlock.tsx`

- [ ] **Step 1: Importer resolver**

Ajouter l'import à côté des imports existants :

```ts
import { resolveSessionMeta } from '@/lib/plan/session-meta'
```

- [ ] **Step 2: Passer `types` au `TemplateCard`**

Dans le `.map(t => <TemplateCard ... />)` (autour de la ligne 205-213), passer `types` qui est déjà disponible via `useActivityTypes()` plus haut dans le composant :

```tsx
{filtered.map(t => (
  <TemplateCard
    key={t.id}
    template={t}
    types={types}
    isCustom={customIds.has(t.id)}
    onClick={() => openEdit(t)}
    onDelete={() => requestDelete(t)}
  />
))}
```

- [ ] **Step 3: Mettre à jour la signature et l'usage dans TemplateCard**

Modifier la signature :

```tsx
function TemplateCard({
  template, types, isCustom, onClick, onDelete,
}: {
  template: SessionTemplate
  types: ActivityType[]
  isCustom: boolean
  onClick: () => void
  onDelete: () => void
}) {
  const meta = resolveSessionMeta(template.type, types)
  // ...
```

Remplacer la ligne `{SESSION_TYPE_LABELS[template.type]}` par `{meta.label}`.

- [ ] **Step 4: Importer ActivityType**

Si `ActivityType` n'est pas déjà importé en haut du fichier, ajouter :

```ts
import type { ActivityType } from '@/types/activity-types'
```

- [ ] **Step 5: Vérifier typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 6: Test manuel**

Créer un template custom (Bibliothèque → + Nouveau, choisir un type custom créé en Task 3) → le label affiché sur la card est bien le nom du type custom.

- [ ] **Step 7: Commit**

```bash
git add web/components/plan/BibliothequeSeancesBlock.tsx
git commit -m "feat(plan): BibliothequeSeancesBlock - TemplateCard label via resolver"
```

---

### Task 10: Smoke test end-to-end manuel

**Files:** aucun (test manuel)

- [ ] **Step 1: Build production**

Run: `cd web && npm run build`
Expected: build succeeds, 0 typecheck error.

- [ ] **Step 2: Lancer la suite Jest complète**

Run: `cd web && npm test`
Expected: 100% pass (les 38 suites existantes + 2 nouvelles tests fichier).

- [ ] **Step 3: Lint complet**

Run: `cd web && npm run lint`
Expected: 0 erreur, 0 warning.

- [ ] **Step 4: Test manuel scénario complet**

`npm run dev` → flux end-to-end :

1. Bibliothèque → ⚙ Personnalisé → créer type custom "Trail Race" avec catégorie "Run" → vérifier badge `RUN` dans la liste
2. Bibliothèque → + Nouveau → dropdown Type → vérifier que "Trail Race" apparaît dans le groupe "Course à pied"
3. Sélectionner "Trail Race" → intensité par défaut = celle saisie en step 1 → enregistrer template
4. Glisser le template "Trail Race" sur un jour de la semaine → la mini-carte affiche `TRAIL RACE` en label-type
5. Cliquer sur la séance → le dropdown a "Trail Race" sélectionné → ajouter un bloc Répéter → vérifier que le toggle Allure est **actif** (cat=run)
6. Changer le type à "Tennis" (custom catégorie 'other') → le toggle Allure devient grisé
7. La bulle km du bloc Semaine reflète la séance "Trail Race" (cat=run) mais pas "Tennis"
8. Vérifier qu'il n'y a aucune erreur console JS

- [ ] **Step 5: Commit final (uniquement si tests/manuel OK)**

Aucun commit nécessaire si Tasks 1-9 sont propres. Sinon, ajouter un commit de fixes.

- [ ] **Step 6: Demander à Franck de tester via Vercel preview**

Pousser sur la branche, créer une PR vers `master` :

```bash
git push origin feat/plan-custom-activity-types
gh pr create --title "feat(plan): types d'activité custom utilisables dans fiches séance" --body "..."
```

Attendre validation Franck avant de merger.

---

## Recap des commits attendus

1. `refactor(plan): SessionType devient string libre + exporter BUILTIN_SESSION_TYPES`
2. `feat(plan): resolver session-meta.ts (builtin/custom/orphan) + tests`
3. `feat(plan): sélecteur catégorie + badge dans ActivityTypesPrefsModal`
4. `feat(plan): SessionEditorModal - dropdown depuis catalogue + coercition mode allure`
5. `feat(plan): TemplateEditorModal - dropdown depuis catalogue + coercition mode allure`
6. `feat(plan): IntensityPaceToggle - prop disabled + coercition pace→level`
7. `feat(plan): propager disabled au toggle Intensité/Allure selon catégorie`
8. `feat(plan): VueSemaineBlock - totaux + label DraggableSessionCard via resolver`
9. `feat(plan): BibliothequeSeancesBlock - TemplateCard label via resolver`

Total : 9 commits, ~14 fichiers touchés (10 modifiés + 4 nouveaux dont 2 tests).
