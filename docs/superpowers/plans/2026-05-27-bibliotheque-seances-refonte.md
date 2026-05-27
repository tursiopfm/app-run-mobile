# Refonte bibliothèque de séances — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réécrire la bibliothèque système de séances (`SESSION_TEMPLATES`) pour qu'un drop d'une séance fractionné/seuil/côtes pré-remplisse la Structure (warmup + RepeatZone + cooldown) et étendre la liste à ~50 séances cohérentes pour prépa trail + route.

**Architecture:** Pas de changement de code applicatif. Une seule modification : le contenu de `web/lib/training/session-templates.ts`. Ajout d'helpers internes au fichier pour DRY le warmup/cooldown. Tests unitaires d'invariants sur les templates.

**Tech Stack:** TypeScript, Jest (`web/__tests__/`), types existants (`@/types/plan`).

**Référence spec :** `docs/superpowers/specs/2026-05-27-bibliotheque-seances-refonte-design.md` (data tables exhaustives par famille).

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `web/lib/training/session-templates.ts` | Tableau hardcodé `SESSION_TEMPLATES`. Source unique des templates système. | Réécrire complètement |
| `web/__tests__/lib/training/session-templates.test.ts` | Tests d'invariants (unicité IDs, intensités valides, structures présentes là où requis, warmups ≥ 20 min). | Créer |

Aucun autre fichier n'est touché : le modèle (`SessionTemplate` dans `web/types/plan.ts`) supporte déjà `defaultZones?: SessionZone[]` ; le DnD (`PlanClient.tsx:126`) recopie déjà `template.defaultZones → session.zones` ; l'éditeur (`SessionEditorModal.tsx:127`) le consomme déjà.

---

### Task 1: Tests d'invariants (red)

**Files:**
- Create: `web/__tests__/lib/training/session-templates.test.ts`

- [ ] **Step 1: Écrire le fichier de tests**

```typescript
// web/__tests__/lib/training/session-templates.test.ts
import { SESSION_TEMPLATES } from '@/lib/training/session-templates'
import { BUILTIN_SESSION_TYPES, isRepeatZone } from '@/types/plan'

describe('SESSION_TEMPLATES', () => {
  it('a tous les IDs uniques', () => {
    const ids = SESSION_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('utilise uniquement des types builtin', () => {
    for (const t of SESSION_TEMPLATES) {
      expect(BUILTIN_SESSION_TYPES).toContain(t.type as any)
    }
  })

  it('a des defaultIntensity ∈ [1,5]', () => {
    for (const t of SESSION_TEMPLATES) {
      expect(t.defaultIntensity).toBeGreaterThanOrEqual(1)
      expect(t.defaultIntensity).toBeLessThanOrEqual(5)
    }
  })

  it('a des defaultDuration > 0', () => {
    for (const t of SESSION_TEMPLATES) {
      expect(t.defaultDuration).toBeGreaterThan(0)
    }
  })

  it('a une structure pour toutes les séances fractionné/seuil_tempo/côtes', () => {
    const STRUCTURED = ['fractionne', 'seuil_tempo', 'cotes']
    for (const t of SESSION_TEMPLATES) {
      if (!STRUCTURED.includes(t.type)) continue
      // Tempo continu = un main, OK. Sinon RepeatZone attendu.
      expect(t.defaultZones).toBeDefined()
      expect(t.defaultZones!.length).toBeGreaterThan(0)
    }
  })

  it('a un warmup ≥ 20 min sur toutes les séances qui en ont un', () => {
    for (const t of SESSION_TEMPLATES) {
      const wu = t.defaultZones?.find(z => !isRepeatZone(z) && z.kind === 'warmup')
      if (!wu) continue
      // On a déjà filtré : ce n'est pas une RepeatZone, donc on peut lire durationMin.
      if (!isRepeatZone(wu)) {
        expect(wu.durationMin).toBeGreaterThanOrEqual(20)
      }
    }
  })

  it('a un cooldown ≥ 10 min sur toutes les séances qui en ont un', () => {
    for (const t of SESSION_TEMPLATES) {
      const cd = t.defaultZones?.find(z => !isRepeatZone(z) && z.kind === 'cooldown')
      if (!cd) continue
      if (!isRepeatZone(cd)) {
        expect(cd.durationMin).toBeGreaterThanOrEqual(10)
      }
    }
  })

  it('a aucun defaultZones sur renfo/musculation', () => {
    for (const t of SESSION_TEMPLATES) {
      if (t.type === 'renfo' || t.type === 'musculation') {
        expect(t.defaultZones).toBeUndefined()
      }
    }
  })

  it('a des RepeatZone bien formés (repeats ≥ 2, ≥ 1 step, mode/distance/durée cohérents)', () => {
    for (const t of SESSION_TEMPLATES) {
      for (const z of t.defaultZones ?? []) {
        if (!isRepeatZone(z)) continue
        expect(z.repeats).toBeGreaterThanOrEqual(2)
        expect(z.steps.length).toBeGreaterThanOrEqual(1)
        for (const step of z.steps) {
          if (step.mode === 'duration') {
            expect(step.durationMin).toBeDefined()
          } else if (step.mode === 'distance') {
            expect(step.distanceM).toBeDefined()
          }
          if (step.intensityMode === 'level') {
            expect(step.intensity).toBeDefined()
          } else if (step.intensityMode === 'pace') {
            expect(step.paceSecPerKm).toBeDefined()
          }
        }
      }
    }
  })

  it('couvre les 12 types builtin', () => {
    const typesPresent = new Set(SESSION_TEMPLATES.map(t => t.type))
    for (const builtin of BUILTIN_SESSION_TYPES) {
      expect(typesPresent.has(builtin)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Lancer les tests, observer les échecs**

Depuis `web/` :

```bash
npx jest __tests__/lib/training/session-templates.test.ts
```

Expected : le test "a une structure pour toutes les séances fractionné/seuil_tempo/côtes" échoue (aucun template actuel n'a `defaultZones`). Les autres tests peuvent passer ou échouer selon les warmups absents.

- [ ] **Step 3: Commit**

```bash
git add web/__tests__/lib/training/session-templates.test.ts
git commit -m "test(plan): add SESSION_TEMPLATES invariants (red)"
```

---

### Task 2: Helpers internes au fichier `session-templates.ts`

**Files:**
- Modify: `web/lib/training/session-templates.ts` (haut du fichier)

- [ ] **Step 1: Lire l'état actuel du fichier**

Lire `web/lib/training/session-templates.ts` pour comprendre le format actuel.

- [ ] **Step 2: Remplacer l'imports header et ajouter les helpers**

Remplacer les lignes 1-7 (imports + ouverture de `SESSION_TEMPLATES`) par :

```typescript
// Bibliothèque de templates de séances système.
// Source unique : ce fichier exporte SESSION_TEMPLATES, utilisé par
// BibliothequeSeancesBlock comme catalogue par défaut.
//
// Convention `defaultZones` :
// - fractionne / seuil_tempo (intervalles) / cotes  → warmup + RepeatZone + cooldown
// - seuil_tempo (tempo continu)                     → warmup + main + cooldown
// - sortie_longue                                   → 1 ou 3 mains (avec bloc)
// - footing / runtaf / velotaf / velo / natation    → 1 main (ou Repeat pour nat fractionnée)
// - renfo / musculation                             → aucune zone
//
// Référence spec : docs/superpowers/specs/2026-05-27-bibliotheque-seances-refonte-design.md

import type {
  SessionTemplate,
  TrainingZone,
  RepeatZone,
  RepeatStep,
  IntensityLevel,
} from '@/types/plan'

// ── Helpers de construction des zones ─────────────────────────────────

function warmup(durationMin: number = 20): TrainingZone {
  return {
    id: 'wu',
    kind: 'warmup',
    mode: 'duration',
    durationMin,
    intensity: 2,
    intensityMode: 'level',
    label: 'Échauffement',
  }
}

function cooldown(durationMin: number = 10): TrainingZone {
  return {
    id: 'cd',
    kind: 'cooldown',
    mode: 'duration',
    durationMin,
    intensity: 2,
    intensityMode: 'level',
    label: 'Retour au calme',
  }
}

function main(durationMin: number, intensity: IntensityLevel, label?: string): TrainingZone {
  return {
    id: `main-${intensity}-${durationMin}`,
    kind: 'main',
    mode: 'duration',
    durationMin,
    intensity,
    intensityMode: 'level',
    label,
  }
}

function effortStep(opts: {
  id?: string
  durationMin?: number
  distanceM?: number
  intensity: IntensityLevel
  label?: string
}): RepeatStep {
  const mode = opts.distanceM != null ? 'distance' : 'duration'
  return {
    id: opts.id ?? 'ef',
    stepKind: 'effort',
    mode,
    durationMin: opts.durationMin,
    distanceM: opts.distanceM,
    intensityMode: 'level',
    intensity: opts.intensity,
    label: opts.label,
  }
}

function recoveryStep(opts: {
  id?: string
  durationMin?: number
  distanceM?: number
  intensity?: IntensityLevel
  label?: string
}): RepeatStep {
  const mode = opts.distanceM != null ? 'distance' : 'duration'
  return {
    id: opts.id ?? 'rc',
    stepKind: 'recovery',
    mode,
    durationMin: opts.durationMin,
    distanceM: opts.distanceM,
    intensityMode: 'level',
    intensity: opts.intensity ?? 1,
    label: opts.label,
  }
}

function repeat(opts: {
  repeats: number
  effort: RepeatStep
  recovery: RepeatStep
  skipLastRecovery?: boolean
  id?: string
}): RepeatZone {
  return {
    id: opts.id ?? 'rep',
    kind: 'repeat',
    repeats: opts.repeats,
    skipLastRecovery: opts.skipLastRecovery ?? true,
    steps: [opts.effort, opts.recovery],
  }
}

// ── Catalogue ─────────────────────────────────────────────────────────

export const SESSION_TEMPLATES: SessionTemplate[] = [
```

(Le reste du fichier — le contenu du tableau — sera réécrit dans Task 3.)

- [ ] **Step 3: Ne pas commit tout de suite**

L'état intermédiaire ne compile pas : on a redéfini l'ouverture mais le contenu suit. On commit après Task 3.

---

### Task 3: Réécriture complète du contenu `SESSION_TEMPLATES`

**Files:**
- Modify: `web/lib/training/session-templates.ts` (lignes 7 à fin)

**Référence data :** spec `docs/superpowers/specs/2026-05-27-bibliotheque-seances-refonte-design.md` sections "Contenu de la nouvelle bibliothèque (~50 séances)". Suivre les tables ligne par ligne (titre, durée, distance, D+, intensité, structure).

- [ ] **Step 1: Remplacer tout le contenu entre `export const SESSION_TEMPLATES: SessionTemplate[] = [` et `]` final**

Le tableau doit contenir **50 entrées exactement**, dans l'ordre suivant des familles :
1. Récupération & footing (6) : `ft-recup-30`, `ft-decrassage-20`, `ft-30`, `ft-45`, `ft-1h`, `ft-progressif-1h`
2. Sortie longue (5) : `sl-1h30`, `sl-2h-progressive`, `sl-2h30`, `sl-3h-spe`, `sl-bloc-marathon`
3. Tempo (3) : `te-tempo-30`, `te-2x15`, `te-am-45`
4. Seuil (6) : `se-4x8`, `se-3x10`, `se-2x20`, `se-6x6`, `te-40min`, `se-2x4km-semi`
5. VMA courte (4) : `fr-30-30`, `fr-45-15`, `fr-10x200`, `fr-15x300`
6. VMA longue (6) : `fr-10x400`, `fr-6x500`, `fr-5x1000`, `fr-4x1500-5k`, `fr-3x6min`, `fr-5x3min`
7. Côtes (6) : `co-10x30s`, `co-12x45s`, `co-6x2min`, `co-4x4min`, `co-bosses-natu`, `co-bosses-2h`
8. Course (3) : `cr-cible`, `cr-prep`, `cr-test-10k`
9. Cross-training (5) : `velo-1h30-eb`, `velo-2h-vallonne`, `vt-1h`, `nat-45min-endurance`, `nat-1h-fract`
10. Runtaf (2) : `rt-aller`, `rt-double`
11. Renfo / Musculation (4) : `renfo-30min-trail`, `renfo-45min-complet`, `muscu-jambes`, `muscu-haut-corps`

**Total : 50.**

**Patterns à appliquer**, exemples canoniques :

**Pattern A — fractionné distance (ex `fr-10x400`) :**

```typescript
{
  id: 'fr-10x400',
  type: 'fractionne',
  title: '10×400m VMA',
  defaultDuration: 65,
  defaultDistance: 9,
  defaultIntensity: 5,
  description: 'WU 20min + 10×400m R=1min trot + CD 10min. Allure VMA (95–100%).',
  tags: ['VMA', 'piste'],
  defaultZones: [
    warmup(),
    repeat({
      repeats: 10,
      effort: effortStep({ distanceM: 400, intensity: 5, label: '400m VMA' }),
      recovery: recoveryStep({ durationMin: 1, label: 'Trot 1min' }),
    }),
    cooldown(),
  ],
},
```

**Pattern B — fractionné durée (ex `fr-3x6min`) :**

```typescript
{
  id: 'fr-3x6min',
  type: 'fractionne',
  title: '3×6min VMA',
  defaultDuration: 65,
  defaultDistance: 10,
  defaultIntensity: 5,
  description: 'WU 20min + 3×6min R=2min30 trot + CD 10min. Allure 92–95% VMA.',
  tags: ['VMA', 'long'],
  defaultZones: [
    warmup(),
    repeat({
      repeats: 3,
      effort: effortStep({ durationMin: 6, intensity: 5, label: '6min VMA' }),
      recovery: recoveryStep({ durationMin: 2.5, label: 'Trot 2min30' }),
    }),
    cooldown(),
  ],
},
```

**Pattern C — seuil intervalles (ex `se-2x20`) :**

```typescript
{
  id: 'se-2x20',
  type: 'seuil_tempo',
  title: '2×20min Seuil',
  defaultDuration: 75,
  defaultDistance: 13,
  defaultIntensity: 4,
  description: 'WU 20min + 2×20min seuil R=3min trot + CD 10min. Séance clé semi.',
  tags: ['seuil', 'long'],
  defaultZones: [
    warmup(),
    repeat({
      repeats: 2,
      effort: effortStep({ durationMin: 20, intensity: 4, label: '20min seuil' }),
      recovery: recoveryStep({ durationMin: 3, label: 'Trot 3min' }),
    }),
    cooldown(),
  ],
},
```

**Pattern D — tempo continu (ex `te-40min`) :**

```typescript
{
  id: 'te-40min',
  type: 'seuil_tempo',
  title: 'Tempo 40min continu',
  defaultDuration: 70,
  defaultDistance: 12,
  defaultIntensity: 4,
  description: 'WU 20min + 40min continu allure seuil bas + CD 10min.',
  tags: ['tempo', 'seuil'],
  defaultZones: [
    warmup(),
    main(40, 4, '40min seuil bas'),
    cooldown(),
  ],
},
```

**Pattern E — côtes courtes (ex `co-10x30s`) :**

```typescript
{
  id: 'co-10x30s',
  type: 'cotes',
  title: '10×30s côtes raides',
  defaultDuration: 55,
  defaultDistance: 8,
  defaultElevation: 200,
  defaultIntensity: 5,
  description: 'WU 20min + 10×30s côte raide récup descente trot + CD 10min.',
  tags: ['côtes', 'court', 'puissance'],
  defaultZones: [
    warmup(),
    repeat({
      repeats: 10,
      effort: effortStep({ durationMin: 0.5, intensity: 5, label: '30s côte' }),
      recovery: recoveryStep({ durationMin: 1, label: 'Descente trot' }),
    }),
    cooldown(),
  ],
},
```

**Pattern F — côtes longues (warmup 25 min) (ex `co-4x4min`) :**

```typescript
{
  id: 'co-4x4min',
  type: 'cotes',
  title: '4×4min côtes longues',
  defaultDuration: 80,
  defaultDistance: 11,
  defaultElevation: 400,
  defaultIntensity: 4,
  description: 'WU 25min + 4×4min côte modérée R=3min descente trot + CD 10min. Séance clé trail.',
  tags: ['côtes', 'long', 'seuil'],
  defaultZones: [
    warmup(25),
    repeat({
      repeats: 4,
      effort: effortStep({ durationMin: 4, intensity: 4, label: '4min côte' }),
      recovery: recoveryStep({ durationMin: 3, label: 'Descente trot' }),
    }),
    cooldown(),
  ],
},
```

**Pattern G — sortie longue simple (ex `sl-1h30`) :**

```typescript
{
  id: 'sl-1h30',
  type: 'sortie_longue',
  title: 'SL 1h30 vallonnée',
  defaultDuration: 90,
  defaultDistance: 15,
  defaultElevation: 400,
  defaultIntensity: 2,
  description: 'Endurance fondamentale sur terrain vallonné. Allure conversationnelle.',
  tags: ['endurance', 'base'],
  defaultZones: [main(90, 2)],
},
```

**Pattern H — sortie longue progressive (ex `sl-2h-progressive`) :**

```typescript
{
  id: 'sl-2h-progressive',
  type: 'sortie_longue',
  title: 'SL 2h progressive',
  defaultDuration: 120,
  defaultDistance: 20,
  defaultElevation: 500,
  defaultIntensity: 2,
  description: 'Sortie longue : 90min EF + 30min en allure soutenue (Z3).',
  tags: ['endurance', 'progressive'],
  defaultZones: [
    main(90, 2, '90min EF'),
    main(30, 3, '30min Z3'),
  ],
},
```

**Pattern I — sortie longue avec bloc (ex `sl-3h-spe`) :**

```typescript
{
  id: 'sl-3h-spe',
  type: 'sortie_longue',
  title: 'SL 3h spé trail',
  defaultDuration: 180,
  defaultDistance: 28,
  defaultElevation: 900,
  defaultIntensity: 3,
  description: 'SL trail : 60min EF + 60min relances en côtes (Z3) + 60min EF.',
  tags: ['spécifique', 'long', 'trail'],
  defaultZones: [
    main(60, 2, '60min EF'),
    main(60, 3, '60min relances Z3'),
    main(60, 2, '60min retour EF'),
  ],
},
```

**Pattern J — footing simple (ex `ft-1h`) :**

```typescript
{
  id: 'ft-1h',
  type: 'footing',
  title: 'Footing 1h',
  defaultDuration: 60,
  defaultDistance: 10,
  defaultIntensity: 2,
  description: 'Footing aérobie 1h, allure conversationnelle.',
  tags: ['endurance', 'aérobie'],
  defaultZones: [main(60, 2)],
},
```

**Pattern K — récupération (ex `ft-recup-30`) :**

```typescript
{
  id: 'ft-recup-30',
  type: 'footing',
  title: 'Footing récup 30min',
  defaultDuration: 30,
  defaultDistance: 4,
  defaultIntensity: 1,
  description: 'Footing très lent Z1 pour récupération active.',
  tags: ['récup', 'court'],
  defaultZones: [main(30, 1)],
},
```

**Pattern L — natation fractionnée (`nat-1h-fract`) :**

```typescript
{
  id: 'nat-1h-fract',
  type: 'natation',
  title: 'Natation 1h fractionnée',
  defaultDuration: 60,
  defaultDistance: 2.5,
  defaultIntensity: 4,
  description: '16×50m allure soutenue R=15s. Renforcement cardio.',
  tags: ['natation', 'fractionné'],
  defaultZones: [
    repeat({
      repeats: 16,
      effort: effortStep({ distanceM: 50, intensity: 4, label: '50m allure' }),
      recovery: recoveryStep({ durationMin: 0.25, label: 'R 15s' }),
    }),
  ],
},
```

**Pattern M — séance hors course (renfo, muscu) :**

```typescript
{
  id: 'renfo-30min-trail',
  type: 'renfo',
  title: 'Renfo trail 30min',
  defaultDuration: 30,
  defaultIntensity: 3,
  description: 'Gainage + spécifique pieds-chevilles-quadri pour trail.',
  tags: ['renfo', 'gainage', 'trail'],
  // pas de defaultZones : séance hors course à durée fixe
},
```

**Pattern N — course objectif (paramétrable) :**

```typescript
{
  id: 'cr-cible',
  type: 'course',
  title: 'Course objectif',
  defaultDuration: 240,
  defaultIntensity: 4,
  description: 'Course cible. Distance, D+ et durée à personnaliser.',
  tags: ['objectif'],
  defaultZones: [main(240, 4, 'Course')],
},
```

**Données pour les 50 entrées** : utiliser les tables de la spec section par section. Pour chaque entrée, choisir le pattern (A à N) qui correspond et l'adapter (durée, intensité, distance, label).

**Conversions utiles :**
- Récup `R=1min15` → `durationMin: 1.25`
- Récup `R=15s` → `durationMin: 0.25`
- Récup `R=30s` → `durationMin: 0.5`
- Récup `R=45s` → `durationMin: 0.75`
- Récup `R=2min30` → `durationMin: 2.5`
- Récup `R=1min30` → `durationMin: 1.5`

**Spécificités à respecter :**
- `co-bosses-natu` : titre = "Sortie bosses 1h30" (renommage du libellé seul, ID inchangé).
- `co-4x4min` : warmup à 25 min (`warmup(25)`).
- `cr-cible` : durée 240, structure 1 main paramétrable.
- `cr-prep` : durée 90, intensité 4, structure 1 main.

- [ ] **Step 2: Lancer les tests**

Depuis `web/` :

```bash
npx jest __tests__/lib/training/session-templates.test.ts
```

Expected : tous les tests passent (10 it).

- [ ] **Step 3: Lancer le linter**

```bash
npm run lint
```

Expected : pas d'erreur sur `session-templates.ts` ni sur le fichier de test.

- [ ] **Step 4: Lancer la suite de tests complète**

```bash
npm test
```

Expected : suite verte, ou au pire les mêmes échecs préexistants (les tests Plan existants ne doivent pas se mettre à échouer).

- [ ] **Step 5: Commit**

```bash
git add web/lib/training/session-templates.ts web/__tests__/lib/training/session-templates.test.ts
git commit -m "feat(plan): bibliothèque de séances avec structures pré-remplies

- 50 templates (vs 27) couvrant trail + route + ultra
- defaultZones pré-rempli sur fractionné/seuil/côtes (WU 20min + RepeatZone + CD 10min)
- IDs existants tous préservés
- Tests d'invariants : unicité, intensités valides, structures cohérentes"
```

---

### Task 4: Smoke test manuel + ajustements

**Files:** aucun changement attendu, juste vérification UI.

- [ ] **Step 1: Lancer le dev server**

```bash
cd web
npm run dev
```

Ouvrir `http://localhost:3000` et se logger.

- [ ] **Step 2: Vérifier le drop d'un fractionné**

1. Aller sur l'onglet **Plan**.
2. Filtrer la bibliothèque sur `fractionne`.
3. Glisser **10×400m VMA** sur un jour du calendrier.
4. Cliquer sur la séance créée pour ouvrir l'éditeur.
5. Aller dans l'onglet **Structure** : attendu = warmup 20min + 10× (400m / 1min trot) + cooldown 10min.

- [ ] **Step 3: Vérifier un seuil**

Idem avec **2×20min Seuil** : attendu = WU 20min + Repeat 2× (20min int4 + 3min trot) + CD 10min.

- [ ] **Step 4: Vérifier une côte longue**

Idem avec **4×4min côtes longues** : attendu = WU **25min** + Repeat 4× (4min int4 + 3min descente trot) + CD 10min.

- [ ] **Step 5: Vérifier qu'une SL simple ne casse pas**

Drop **SL 1h30 vallonnée** : Structure = 1 main 90min int2. OK si juste une zone simple.

- [ ] **Step 6: Vérifier qu'une muscu n'a pas de Structure**

Drop **Muscu jambes** : section Structure vide (séance hors course). OK.

- [ ] **Step 7: Si tout est OK, rien à committer (déjà fait au Step 5 de Task 3)**

Si un défaut est trouvé (ex : intensité décalée, libellé moche, durée fausse), corriger dans `session-templates.ts` puis :

```bash
npm test
git commit -am "fix(plan): ajustement template <id>"
```

---

## Self-review

**Spec coverage :**
- Convention de structure par type → Task 3 patterns A à N.
- 50 séances, IDs et données → Task 3 Step 1 (référence spec tables).
- Préservation des IDs existants → Task 3 (liste explicite des 50 IDs, dont les anciens).
- Tests d'invariants → Task 1.
- Smoke UI → Task 4.

**Placeholders :** aucun. Tous les patterns sont fournis avec code complet. Les données numériques par séance sont dans la spec — référence claire.

**Type consistency :** les helpers (`warmup`, `cooldown`, `main`, `effortStep`, `recoveryStep`, `repeat`) sont définis en Task 2 et utilisés exclusivement en Task 3. Signatures cohérentes (`IntensityLevel`, `durationMin: number`, `distanceM?: number`).

**Risques résiduels :**
- Le `repeat()` helper expose toujours `skipLastRecovery: true` par défaut, ce qui est cohérent avec l'usage (on ne fait pas de récup après la dernière répétition). Override possible par l'utilisateur dans l'éditeur.
- Les tags français contiennent des accents (`côtes`, `récup`) : OK, déjà le cas dans l'existant.
