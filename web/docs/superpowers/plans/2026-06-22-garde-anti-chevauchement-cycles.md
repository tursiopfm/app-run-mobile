# Garde anti-chevauchement de cycles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avertir l'utilisateur (avec propositions d'action) quand il enregistre un macrocycle dont la période chevauche un autre cycle actif, au lieu de masquer silencieusement l'un des deux.

**Architecture :** une fonction pure `findActiveOverlaps` (lib, testée), un hook `useOverlapGuard` qui orchestre détection → dialogue → enregistrement (archiver l'autre / confirmer / annuler), et le câblage de ce hook sur les deux chemins de save (`PhaseEditorModal` + `StructurePrepaBlock`).

**Tech Stack :** Next.js 14 (App Router), TypeScript, React 18 (`createPortal`), Tailwind, i18n maison (`useT`), Jest.

## Global Constraints

- Toutes les commandes s'exécutent **depuis `web/`** (cwd). `git` depuis la racine du repo.
- Branche de travail : `feat/garde-chevauchement-cycles` (déjà créée, la spec y est committée).
- « Actif » = `status !== 'archived'` (cohérent avec `pickActiveMacrocycle`).
- Chevauchement = comparaison **stricte** : `candidate.startDate < other.endDate && other.startDate < candidate.endDate` (deux cycles bout-à-bout partageant un jour-frontière ne sont PAS en conflit).
- Dates = chaînes ISO `YYYY-MM-DD` (comparaison lexicographique = chronologique).
- Aucune migration Supabase (l'archivage réutilise le statut `archived` existant).
- Vérif locale = `npx tsc --noEmit` + `npm run lint` (le build autoritatif tourne sur Vercel). Tests Jest ciblés sur les suites pertinentes (≈50 tests i18n échouent en pré-existant hors périmètre).

---

### Task 1 : `findActiveOverlaps` (détection pure)

**Files:**
- Create: `web/lib/plan/overlap.ts`
- Test: `web/__tests__/lib/plan/overlap.test.ts`

**Interfaces:**
- Consumes: `TrainingPlan` depuis `@/types/plan`.
- Produces: `findActiveOverlaps(candidate: TrainingPlan, all: TrainingPlan[]): TrainingPlan[]`.

- [ ] **Step 1 : Écrire le test qui échoue**

Create `web/__tests__/lib/plan/overlap.test.ts` :

```ts
import { findActiveOverlaps } from '@/lib/plan/overlap'
import type { TrainingPlan } from '@/types/plan'

function makePlan(overrides: Partial<TrainingPlan>): TrainingPlan {
  return {
    id: 'plan-x',
    athleteId: 'athlete-1',
    name: 'Macro X',
    goalRaceId: null,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    phases: [],
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('findActiveOverlaps', () => {
  it('signale un cycle imbrié dans le candidat (cas Franck)', () => {
    const candidate = makePlan({ id: 'detail', startDate: '2026-05-10', endDate: '2026-08-30' })
    const nested = makePlan({ id: 'affutage', startDate: '2026-06-19', endDate: '2026-06-26' })
    expect(findActiveOverlaps(candidate, [candidate, nested]).map(p => p.id)).toEqual(['affutage'])
  })

  it('signale un recouvrement partiel', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-07-01' })
    const other = makePlan({ id: 'b', startDate: '2026-06-15', endDate: '2026-09-01' })
    expect(findActiveOverlaps(candidate, [other]).map(p => p.id)).toEqual(['b'])
  })

  it('ne signale PAS deux cycles bout-à-bout (frontière partagée)', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-06-28' })
    const other = makePlan({ id: 'b', startDate: '2026-06-28', endDate: '2026-08-01' })
    expect(findActiveOverlaps(candidate, [other])).toEqual([])
  })

  it('exclut les cycles archived', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-07-01' })
    const arch = makePlan({ id: 'arch', startDate: '2026-05-15', endDate: '2026-06-15', status: 'archived' })
    expect(findActiveOverlaps(candidate, [arch])).toEqual([])
  })

  it('exclut le candidat lui-même (cas édition)', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-07-01' })
    expect(findActiveOverlaps(candidate, [candidate])).toEqual([])
  })

  it('inclut un cycle completed (toujours visible donc masquant)', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-07-01' })
    const done = makePlan({ id: 'done', startDate: '2026-06-01', endDate: '2026-06-20', status: 'completed' })
    expect(findActiveOverlaps(candidate, [done]).map(p => p.id)).toEqual(['done'])
  })

  it('retourne tous les conflits multiples', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-01-01', endDate: '2026-12-31' })
    const b = makePlan({ id: 'b', startDate: '2026-03-01', endDate: '2026-04-01' })
    const c = makePlan({ id: 'c', startDate: '2026-09-01', endDate: '2026-10-01' })
    expect(findActiveOverlaps(candidate, [candidate, b, c]).map(p => p.id)).toEqual(['b', 'c'])
  })

  it('retourne [] quand aucun conflit', () => {
    const candidate = makePlan({ id: 'a', startDate: '2026-05-01', endDate: '2026-07-01' })
    const far = makePlan({ id: 'far', startDate: '2026-10-01', endDate: '2026-11-01' })
    expect(findActiveOverlaps(candidate, [far])).toEqual([])
  })
})
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npx jest __tests__/lib/plan/overlap.test.ts`
Expected: FAIL — `Cannot find module '@/lib/plan/overlap'`.

- [ ] **Step 3 : Implémenter la fonction pure**

Create `web/lib/plan/overlap.ts` :

```ts
// Détection pure des chevauchements de macrocycles (sans I/O).
// « Actif » = status !== 'archived' (cohérent avec pickActiveMacrocycle).
// Chevauchement STRICT : deux cycles bout-à-bout partageant un seul jour-frontière
// ne sont pas en conflit ; un cycle imbriqué ou un recouvrement le sont.

import type { TrainingPlan } from '@/types/plan'

export function findActiveOverlaps(
  candidate: TrainingPlan,
  all: TrainingPlan[],
): TrainingPlan[] {
  return all.filter(
    (other) =>
      other.id !== candidate.id &&
      other.status !== 'archived' &&
      candidate.startDate < other.endDate &&
      other.startDate < candidate.endDate,
  )
}
```

- [ ] **Step 4 : Lancer le test → succès attendu**

Run: `npx jest __tests__/lib/plan/overlap.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5 : Commit**

```bash
git add web/lib/plan/overlap.ts web/__tests__/lib/plan/overlap.test.ts
git commit -m "feat(plan): findActiveOverlaps — détection pure des chevauchements de cycles"
```

---

### Task 2 : i18n + hook `useOverlapGuard`

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts` (déclaration de type ~ligne 605 + valeurs ~ligne 2553)
- Modify: `web/lib/i18n/dictionaries/en.ts` (valeurs ~ligne 1342)
- Create: `web/components/plan/useOverlapGuard.tsx`

**Interfaces:**
- Consumes: `findActiveOverlaps` (Task 1) ; `getAllMacrocycles`, `saveCurrentPlan` depuis `@/lib/plan/storage` ; `useT().plan`.
- Produces: `useOverlapGuard(): { guardedSave: (candidate: TrainingPlan) => Promise<boolean>; dialog: React.ReactNode }`. Nouvelles clés i18n `plan` : `overlapTitle`, `overlapBody`, `overlapItem(name,start,end)`, `overlapArchive`, `overlapAdjust`, `overlapConfirm`.

- [ ] **Step 1 : Ajouter les clés i18n (déclaration de type, FR)**

Dans `web/lib/i18n/dictionaries/fr.ts`, après la ligne `structurePlanName: (name: string) => string` (la déclaration de type, ~ligne 605), ajouter :

```ts
    overlapTitle: string; overlapBody: string
    overlapItem: (name: string, start: string, end: string) => string
    overlapArchive: string; overlapAdjust: string; overlapConfirm: string
```

Puis, après la ligne de valeur `structurePlanName:   (name: string) => \`Prépa ${name}\`,` (~ligne 2553), ajouter :

```ts

    // Garde anti-chevauchement de cycles
    overlapTitle:   'Chevauchement de cycles',
    overlapBody:    'Ce cycle recouvre la période d’un ou plusieurs cycles actifs :',
    overlapItem:    (name: string, start: string, end: string) => `${name} (${start} → ${end})`,
    overlapArchive: 'Archiver le(s) cycle(s) en conflit',
    overlapAdjust:  'Ajuster les dates',
    overlapConfirm: 'Confirmer quand même',
```

- [ ] **Step 2 : Ajouter les valeurs EN**

Dans `web/lib/i18n/dictionaries/en.ts`, après la ligne `structurePlanName:   (name: string) => \`${name} plan\`,` (~ligne 1342), ajouter :

```ts

    // Overlap guard
    overlapTitle:   'Overlapping cycles',
    overlapBody:    'This cycle overlaps one or more active cycles:',
    overlapItem:    (name: string, start: string, end: string) => `${name} (${start} → ${end})`,
    overlapArchive: 'Archive the conflicting cycle(s)',
    overlapAdjust:  'Adjust the dates',
    overlapConfirm: 'Keep it anyway',
```

- [ ] **Step 3 : Créer le hook + dialogue**

Create `web/components/plan/useOverlapGuard.tsx` :

```tsx
'use client'

// Garde anti-chevauchement : enveloppe l'enregistrement d'un macrocycle.
// Si le candidat chevauche un (des) cycle(s) actif(s), ouvre un dialogue
// « avertir + proposer » (archiver l'autre / confirmer quand même / ajuster).
// La logique de détection est pure (lib/plan/overlap) ; ce hook orchestre l'I/O + l'UI.

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { TrainingPlan } from '@/types/plan'
import { getAllMacrocycles, saveCurrentPlan } from '@/lib/plan/storage'
import { findActiveOverlaps } from '@/lib/plan/overlap'
import { useT } from '@/lib/i18n/I18nProvider'

function fmtDDMM(iso: string): string {
  return iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso
}

export function useOverlapGuard(): { guardedSave: (candidate: TrainingPlan) => Promise<boolean>; dialog: ReactNode } {
  const L = useT().plan
  const [conflicts, setConflicts] = useState<TrainingPlan[] | null>(null)
  const candidateRef = useRef<TrainingPlan | null>(null)
  const resolveRef = useRef<((saved: boolean) => void) | null>(null)

  const guardedSave = useCallback(async (candidate: TrainingPlan): Promise<boolean> => {
    const all = await getAllMacrocycles()
    const found = findActiveOverlaps(candidate, all)
    if (found.length === 0) {
      await saveCurrentPlan(candidate)
      return true
    }
    candidateRef.current = candidate
    setConflicts(found)
    return new Promise<boolean>((resolve) => { resolveRef.current = resolve })
  }, [])

  const settle = useCallback((saved: boolean) => {
    setConflicts(null)
    candidateRef.current = null
    const r = resolveRef.current
    resolveRef.current = null
    r?.(saved)
  }, [])

  const handleArchive = useCallback(async () => {
    const candidate = candidateRef.current
    const found = conflicts ?? []
    if (!candidate) return settle(false)
    for (const c of found) await saveCurrentPlan({ ...c, status: 'archived' })
    await saveCurrentPlan(candidate)
    settle(true)
  }, [conflicts, settle])

  const handleConfirm = useCallback(async () => {
    const candidate = candidateRef.current
    if (!candidate) return settle(false)
    await saveCurrentPlan(candidate)
    settle(true)
  }, [settle])

  const handleAdjust = useCallback(() => settle(false), [settle])

  const dialog = conflicts && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label={L.overlapTitle}
          onClick={handleAdjust}
        >
          <div
            className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-md p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />
            <h2 className="font-display text-[16px] font-semibold text-trail-text mb-2">{L.overlapTitle}</h2>
            <p className="text-body-sm text-[color:var(--trail-muted)] mb-3">{L.overlapBody}</p>
            <ul className="mb-4 space-y-1">
              {conflicts.map((c) => (
                <li key={c.id} className="text-caption text-trail-text">
                  • {L.overlapItem(c.name, fmtDDMM(c.startDate), fmtDDMM(c.endDate))}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleArchive}
                className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-body font-semibold"
              >
                {L.overlapArchive}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 rounded-[10px] bg-trail-card border border-trail-border text-trail-text text-body-sm font-semibold hover:border-trail-primary"
              >
                {L.overlapConfirm}
              </button>
              <button
                type="button"
                onClick={handleAdjust}
                className="px-4 py-2 rounded-[10px] text-[color:var(--trail-muted)] text-body-sm hover:text-trail-text"
              >
                {L.overlapAdjust}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return { guardedSave, dialog }
}
```

- [ ] **Step 4 : Vérifier types + lint**

Run: `npx tsc --noEmit`
Expected: aucune erreur (les clés i18n sont reconnues sur `Dict['plan']`, le hook compile).
Run: `npm run lint`
Expected: aucune erreur sur les fichiers touchés.

- [ ] **Step 5 : Commit**

```bash
git add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts web/components/plan/useOverlapGuard.tsx
git commit -m "feat(plan): hook useOverlapGuard (dialogue archiver/confirmer/ajuster) + i18n"
```

---

### Task 3 : Câblage `PhaseEditorModal`

**Files:**
- Modify: `web/components/plan/PhaseEditorModal.tsx` (import ~ligne 27, hook ~ligne 138, `handleSave` ~ligne 279, return ~lignes 287 & 385-387)

**Interfaces:**
- Consumes: `useOverlapGuard` (Task 2).

- [ ] **Step 1 : Remplacer l'import direct de `saveCurrentPlan` par le hook**

Dans `web/components/plan/PhaseEditorModal.tsx`, remplacer la ligne 27 :

```ts
import { saveCurrentPlan } from '@/lib/plan/storage'
```

par :

```ts
import { useOverlapGuard } from './useOverlapGuard'
```

- [ ] **Step 2 : Appeler le hook avant le premier early-return**

Juste après le `useMemo` `validationError` (ligne 137) et **avant** `if (!open) return null` (ligne 139), insérer :

```ts
  const { guardedSave, dialog } = useOverlapGuard()
```

- [ ] **Step 3 : Router `handleSave` via `guardedSave`**

Dans `handleSave`, remplacer :

```ts
      await saveCurrentPlan(updated)
      onSaved()
      onClose()
```

par :

```ts
      const saved = await guardedSave(updated)
      if (saved) {
        onSaved()
        onClose()
      }
```

- [ ] **Step 4 : Rendre `{dialog}` en frère du portal du modal**

Remplacer la ligne 287 :

```tsx
  return createPortal(
```

par :

```tsx
  return (<>{createPortal(
```

Et remplacer la fin (lignes 385-387) :

```tsx
    </div>,
    document.body,
  )
```

par :

```tsx
    </div>,
    document.body,
  )}{dialog}</>)
```

- [ ] **Step 5 : Vérifier types + lint + tests plan**

Run: `npx tsc --noEmit`
Expected: aucune erreur (plus de référence orpheline à `saveCurrentPlan`, hooks appelés avant tout return).
Run: `npm run lint`
Expected: aucune erreur.
Run: `npx jest __tests__/lib/plan`
Expected: les suites du dossier passent (dont `overlap.test.ts`).

- [ ] **Step 6 : Commit**

```bash
git add web/components/plan/PhaseEditorModal.tsx
git commit -m "feat(plan): PhaseEditorModal enregistre via le garde anti-chevauchement"
```

---

### Task 4 : Câblage `StructurePrepaBlock`

**Files:**
- Modify: `web/components/plan/StructurePrepaBlock.tsx` (import ~ligne 15, hook ~ligne 95, `handleGenerateInitial` ~lignes 120 & 138, branche `phases.length === 0` ~ligne 235)

**Interfaces:**
- Consumes: `useOverlapGuard` (Task 2).

- [ ] **Step 1 : Remplacer les imports de save par le hook**

Dans `web/components/plan/StructurePrepaBlock.tsx`, remplacer la ligne 15 :

```ts
import { saveCurrentPlan, saveMacrocycle } from '@/lib/plan/storage'
```

par :

```ts
import { useOverlapGuard } from './useOverlapGuard'
```

- [ ] **Step 2 : Appeler le hook avant les early-returns**

Juste après le `useMemo` `seedRace` (ligne 95), insérer :

```ts
  const { guardedSave, dialog } = useOverlapGuard()
```

- [ ] **Step 3 : Router les deux saves de `handleGenerateInitial` via `guardedSave`**

Remplacer (cas 1, ~lignes 120-121) :

```ts
        await saveMacrocycle(newPlan)
        onChange?.()
```

par :

```ts
        if (await guardedSave(newPlan)) onChange?.()
```

Puis remplacer (cas 2, ~lignes 138-139) :

```ts
      await saveCurrentPlan(updated)
      onChange?.()
```

par :

```ts
      if (await guardedSave(updated)) onChange?.()
```

- [ ] **Step 4 : Rendre `{dialog}` dans la branche `phases.length === 0`**

C'est la seule branche pouvant déclencher un conflit (cas 2 : macro existant + autres cycles). Dans cette branche, juste après le `<PhaseEditorModal ... />` sans `focusPhaseId` (lignes 229-235) et avant `</BlockCard>` (ligne 236), insérer `{dialog}` :

```tsx
        <PhaseEditorModal
          plan={activeMacrocycle}
          race={goalRace}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={() => { onChange?.(); setModalOpen(false) }}
        />
        {dialog}
      </BlockCard>
```

> Note : le cas 1 (`!activeMacrocycle`) ne se produit que lorsqu'aucun macrocycle n'existe → `guardedSave` ne trouve jamais de conflit → le dialogue ne s'ouvre pas dans la branche « générer » ; inutile d'y rendre `{dialog}`.

- [ ] **Step 5 : Vérifier types + lint**

Run: `npx tsc --noEmit`
Expected: aucune erreur (imports `saveCurrentPlan`/`saveMacrocycle` retirés car orphelins, hook avant les returns).
Run: `npm run lint`
Expected: aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add web/components/plan/StructurePrepaBlock.tsx
git commit -m "feat(plan): StructurePrepaBlock enregistre via le garde anti-chevauchement"
```

---

## Self-Review (rempli pendant l'écriture du plan)

**1. Couverture spec :**
- Détection pure `findActiveOverlaps` + frontière stricte → Task 1. ✓
- Hook orchestrateur + dialogue 3 actions + i18n → Task 2. ✓
- Câblage des deux chemins (éditeur + génération auto) → Tasks 3 & 4. ✓
- Archivage via statut `archived` (pas d'infra) → hook (Task 2). ✓
- « completed » inclus dans la détection → testé (Task 1). ✓
- Compromis « confirmer quand même » → `handleConfirm` (Task 2). ✓
- Hors-périmètre (sélecteur de cycle, balayage rétroactif, blocage dur) → non implémentés. ✓

**2. Placeholders :** aucun TBD/TODO ; chaque step contient le code complet.

**3. Cohérence des types :** `guardedSave(candidate: TrainingPlan): Promise<boolean>` et `dialog: ReactNode` identiques entre Task 2 (définition) et Tasks 3-4 (consommation). Clés i18n `overlap*` identiques entre déclaration de type, FR, EN et usage dans le hook.
