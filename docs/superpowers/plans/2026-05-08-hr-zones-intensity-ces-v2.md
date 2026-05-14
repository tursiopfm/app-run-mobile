> **Status: Implémenté** · Date: 2026-05-08 · Code: `web/lib/analytics/effort-score.ts`, `web/lib/health/hr-zones.ts`
> *Snapshot de design — pour l'état actuel, voir le code.*

# HR Zones / Intensity / CES v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger le modèle Intensité / Zones FC / CES pour le rendre cohérent scientifiquement, explicable, recalculable, sans fausse précision, avec confidence/source/warnings — en tenant compte de l'absence de HR streams et de laps.

**Architecture:** 8 tâches indépendantes-mais-liées. Les tâches 1-3 corrigent les zones FC. Les tâches 4-5 corrigent l'intensité. Les tâches 6-8 introduisent CES v2 profile-aware et la recalculation. Chaque tâche produit des tests verts avant de passer à la suivante.

**Tech Stack:** TypeScript, Jest (29), Next.js 14, Supabase (PostgreSQL) — tous les fichiers sous `web/`.

---

## File Map

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `web/lib/health/hr-zones.ts` | Modifier | Noms zones, bornes sans chevauchement, `getRecommendedHeartRateZoneMode` |
| `web/lib/health/hr-distribution.ts` | Créer | `HeartRateZoneDistributionResult`, estimation avg+max |
| `web/lib/activities/intensity.ts` | Modifier | Types `Intensity`+`WorkoutType`, `guessIntensity`, `guessWorkoutType`, supprimer fallback CES |
| `web/lib/analytics/types.ts` | Modifier | `UserProfileForCes`, `CesResult` étendu |
| `web/lib/analytics/effort-score.ts` | Modifier | `computeCesResult(activity, profile?)` profile-aware, warnings |
| `web/lib/analytics/fatigue.ts` | Modifier | `FatigueResult` avec confidence (<42 jours) |
| `web/lib/sync/import-activities.ts` | Modifier | Passer profile à `computeCesResult` |
| `web/lib/sync/recalculate-scores.ts` | Créer | `recalculateUserEffortScores`, `recalculateUserFatigue` |
| `web/app/api/profile/route.ts` | Modifier | Autoriser `threshold_pace_run_sec_per_km`, `threshold_pace_trail_sec_per_km` |
| `web/app/api/profile/recalculate/route.ts` | Créer | POST endpoint pour déclencher recalcul |
| `web/supabase/migrations/005_profile_threshold_pace.sql` | Créer | Colonnes allure seuil dans profiles |
| `web/supabase/migrations/006_activity_effort_score_version.sql` | Créer | Colonnes version + updated_at dans activities |
| `web/__tests__/lib/health/hr-zones.test.ts` | Modifier | Noms, bornes, getRecommendedHeartRateZoneMode |
| `web/__tests__/lib/health/hr-distribution.test.ts` | Créer | Distribution estimation |
| `web/__tests__/activities/intensity.test.ts` | Modifier | Nouveau Intensity, WorkoutType, suppression fallback CES |
| `web/__tests__/analytics/effort-score.test.ts` | Modifier | Profile-aware CES, warnings, trail D+ |
| `web/__tests__/analytics/fatigue.test.ts` | Modifier | FatigueResult confidence |

---

## Task 1 — Fix HR zone names + boundaries (no overlap)

**Files:**
- Modify: `web/lib/health/hr-zones.ts`
- Modify: `web/__tests__/lib/health/hr-zones.test.ts`

### Context

`ZONE_NAMES[1]` est actuellement `'Endurance active'` au lieu de `'Endurance fondamentale'`. Les bornes
de `pct_max`, `karvonen` et `test30` se chevauchent (Z2.min === Z1.max). Seul `seuils` est déjà correct.

La fonction `hrZoneForAvgHr` n'utilise que `.max`, donc le comportement runtime ne change pas — seul
l'affichage des bornes dans l'UI est corrigé.

- [ ] **Step 1 : Écrire les tests d'échec (noms + bornes)**

Ajouter à la fin de `web/__tests__/lib/health/hr-zones.test.ts` :

```typescript
describe('zone names', () => {
  it('correct for all 5 zones', () => {
    const { zones } = calculateHrZones({ method: 'pct_max', maxHr: 195 })
    expect(zones[0].name).toBe('Récupération')
    expect(zones[1].name).toBe('Endurance fondamentale')
    expect(zones[2].name).toBe('Endurance active')
    expect(zones[3].name).toBe('Seuil')
    expect(zones[4].name).toBe('Très intense')
  })
})

describe('pct_max FCmax 195 — no overlap', () => {
  const { zones } = calculateHrZones({ method: 'pct_max', maxHr: 195 })
  // Expected: Z1 ≤140, Z2 141–152, Z3 153–166, Z4 167–179, Z5 180–195
  it('Z1 max = 140', () => expect(zones[0].max).toBe(140))
  it('Z2 min = 141, max = 152', () => { expect(zones[1].min).toBe(141); expect(zones[1].max).toBe(152) })
  it('Z3 min = 153, max = 166', () => { expect(zones[2].min).toBe(153); expect(zones[2].max).toBe(166) })
  it('Z4 min = 167, max = 179', () => { expect(zones[3].min).toBe(167); expect(zones[3].max).toBe(179) })
  it('Z5 min = 180, max = 195', () => { expect(zones[4].min).toBe(180); expect(zones[4].max).toBe(195) })
  it('no overlap between any zones', () => {
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].min).toBe((zones[i - 1].max as number) + 1)
    }
  })
})

describe('karvonen FCmax 195 FCrepos 57 — no overlap', () => {
  const { zones } = calculateHrZones({ method: 'karvonen', maxHr: 195, restingHr: 57 })
  // reserve=138 → t(0.60)=140 t(0.70)=154 t(0.80)=167 t(0.90)=181
  it('Z1 max = 140', () => expect(zones[0].max).toBe(140))
  it('Z2 min = 141, max = 154', () => { expect(zones[1].min).toBe(141); expect(zones[1].max).toBe(154) })
  it('Z3 min = 155, max = 167', () => { expect(zones[2].min).toBe(155); expect(zones[2].max).toBe(167) })
  it('Z4 min = 168, max = 181', () => { expect(zones[3].min).toBe(168); expect(zones[3].max).toBe(181) })
  it('Z5 min = 182, max = 195', () => { expect(zones[4].min).toBe(182); expect(zones[4].max).toBe(195) })
  it('no overlap between any zones', () => {
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].min).toBe((zones[i - 1].max as number) + 1)
    }
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd web && npx jest __tests__/lib/health/hr-zones.test.ts --no-coverage
```

Expected : plusieurs FAIL sur les noms et les min/max.

- [ ] **Step 3 : Implémenter les corrections dans `web/lib/health/hr-zones.ts`**

Remplacer l'intégralité du fichier par :

```typescript
export type HrZoneMethod = 'seuils' | 'test30' | 'karvonen' | 'pct_max' | 'auto' | 'custom'

export type HrZone = {
  zone:  number
  name:  string
  min:   number | null
  max:   number
  color: string
}

export type HrZoneResult = {
  zones:      HrZone[]
  method:     HrZoneMethod
  confidence: 'Excellente' | 'Très bien' | 'Bien' | 'Correcte' | 'Approximative' | 'Personnalisée' | null
  maxHrUsed:  number | null
  missing:    string[]
}

const ZONE_NAMES  = ['Récupération', 'Endurance fondamentale', 'Endurance active', 'Seuil', 'Très intense']
const ZONE_COLORS = ['#4caf50', '#38bdf8', '#f59e0b', '#e8651a', '#ef4444']

function makeZones(ranges: [number | null, number][]): HrZone[] {
  return ranges.map(([min, max], i) => ({
    zone:  i + 1,
    name:  ZONE_NAMES[i],
    min,
    max,
    color: ZONE_COLORS[i],
  }))
}

/**
 * Builds zone ranges from an array of max values per zone.
 * min of zone N = max of zone N-1 + 1 (no overlap, no gap).
 */
function pctRanges(maxes: number[]): [number | null, number][] {
  return maxes.map((max, i) => [i === 0 ? null : maxes[i - 1] + 1, max])
}

export function hrZoneForAvgHr(avgHr: number, zones: HrZone[]): number | null {
  if (zones.length === 0) return null
  for (const z of zones) {
    if (avgHr <= z.max) return z.zone
  }
  return zones[zones.length - 1].zone
}

export function calculateHrZones(params: {
  method:              HrZoneMethod
  maxHr?:              number | null
  restingHr?:          number | null
  aerobicThresholdHr?: number | null
  thresholdHr?:        number | null
  birthYear?:          number | null
}): HrZoneResult {
  const { method, maxHr, restingHr, aerobicThresholdHr, thresholdHr, birthYear } = params
  const missing: string[] = []

  function need(val: number | null | undefined, key: string): number | null {
    if (val == null) { missing.push(key); return null }
    return val
  }

  switch (method) {
    case 'seuils': {
      const max = need(maxHr, 'FC max')
      const aet = need(aerobicThresholdHr, 'Seuil aérobie / AeT')
      const lthr = need(thresholdHr, 'Seuil anaérobie / LTHR')
      if (!max || !aet || !lthr) return { zones: [], method, confidence: 'Excellente', maxHrUsed: max, missing }
      return {
        zones: makeZones([
          [null,      aet - 11],
          [aet - 10,  aet],
          [aet + 1,   lthr - 8],
          [lthr - 7,  lthr + 3],
          [lthr + 4,  max],
        ]),
        method, confidence: 'Excellente', maxHrUsed: max, missing,
      }
    }
    case 'test30': {
      const max  = need(maxHr, 'FC max')
      const lthr = need(thresholdHr, 'Seuil anaérobie / LTHR')
      if (!max || !lthr) return { zones: [], method, confidence: 'Très bien', maxHrUsed: max ?? null, missing }
      const maxes = [0.85, 0.89, 0.94, 0.99].map(p => Math.round(lthr * p)).concat([max])
      return { zones: makeZones(pctRanges(maxes)), method, confidence: 'Très bien', maxHrUsed: max, missing }
    }
    case 'karvonen': {
      const max  = need(maxHr, 'FC max')
      const rest = need(restingHr, 'FC repos')
      if (!max || !rest) return { zones: [], method, confidence: 'Bien', maxHrUsed: max ?? null, missing }
      const reserve = max - rest
      const maxes = [0.60, 0.70, 0.80, 0.90].map(p => Math.round(rest + p * reserve)).concat([max])
      return { zones: makeZones(pctRanges(maxes)), method, confidence: 'Bien', maxHrUsed: max, missing }
    }
    case 'pct_max': {
      const max = need(maxHr, 'FC max')
      if (!max) return { zones: [], method, confidence: 'Correcte', maxHrUsed: null, missing }
      const maxes = [0.72, 0.78, 0.85, 0.92].map(p => Math.round(max * p)).concat([max])
      return { zones: makeZones(pctRanges(maxes)), method, confidence: 'Correcte', maxHrUsed: max, missing }
    }
    case 'auto': {
      const by = need(birthYear, 'Année de naissance')
      if (!by) return { zones: [], method, confidence: 'Approximative', maxHrUsed: null, missing }
      const age = new Date().getFullYear() - by
      const estMax = Math.round(208 - 0.7 * age)
      const maxes = [0.72, 0.78, 0.85, 0.92].map(p => Math.round(estMax * p)).concat([estMax])
      return { zones: makeZones(pctRanges(maxes)), method, confidence: 'Approximative', maxHrUsed: estMax, missing }
    }
    default:
      return { zones: [], method, confidence: 'Personnalisée', maxHrUsed: null, missing }
  }
}
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
cd web && npx jest __tests__/lib/health/hr-zones.test.ts --no-coverage
```

Expected : tous PASS, y compris les tests `hrZoneForAvgHr` existants (les max n'ont pas changé).

- [ ] **Step 5 : Commit**

```bash
cd web && git add lib/health/hr-zones.ts __tests__/lib/health/hr-zones.test.ts
git commit -m "fix(hr-zones): correct zone names and eliminate boundary overlaps"
```

---

## Task 2 — `getRecommendedHeartRateZoneMode`

**Files:**
- Modify: `web/lib/health/hr-zones.ts`
- Modify: `web/__tests__/lib/health/hr-zones.test.ts`

### Context

Il n'existe pas de fonction qui choisit automatiquement la meilleure méthode selon le profil.
Actuellement `pct_max` est utilisé par défaut même quand `resting_hr` est disponible (Karvonen serait meilleur).

- [ ] **Step 1 : Écrire les tests d'échec**

Ajouter à `web/__tests__/lib/health/hr-zones.test.ts` :

```typescript
import { calculateHrZones, hrZoneForAvgHr, getRecommendedHeartRateZoneMode } from '@/lib/health/hr-zones'

describe('getRecommendedHeartRateZoneMode', () => {
  it('seuils / high when max + aerobic + threshold available', () => {
    const r = getRecommendedHeartRateZoneMode({ max_hr: 195, aerobic_threshold_hr: 155, threshold_hr: 170 })
    expect(r.mode).toBe('seuils')
    expect(r.confidence).toBe('high')
    expect(r.canCompute).toBe(true)
  })

  it('test30 / good when max + threshold only', () => {
    const r = getRecommendedHeartRateZoneMode({ max_hr: 195, threshold_hr: 170 })
    expect(r.mode).toBe('test30')
    expect(r.confidence).toBe('good')
  })

  it('karvonen / medium when max + resting only', () => {
    const r = getRecommendedHeartRateZoneMode({ max_hr: 195, resting_hr: 57 })
    expect(r.mode).toBe('karvonen')
    expect(r.confidence).toBe('medium')
  })

  it('pct_max / low when max only', () => {
    const r = getRecommendedHeartRateZoneMode({ max_hr: 195 })
    expect(r.mode).toBe('pct_max')
    expect(r.confidence).toBe('low')
  })

  it('auto / very_low when only birth_year', () => {
    const r = getRecommendedHeartRateZoneMode({ birth_year: 1985 })
    expect(r.mode).toBe('auto')
    expect(r.confidence).toBe('very_low')
    expect(r.canCompute).toBe(true)
  })

  it('canCompute = false when nothing available', () => {
    const r = getRecommendedHeartRateZoneMode({})
    expect(r.canCompute).toBe(false)
  })

  it('prefers karvonen over pct_max when resting_hr present (no threshold)', () => {
    const r = getRecommendedHeartRateZoneMode({ max_hr: 195, resting_hr: 57 })
    expect(r.mode).toBe('karvonen')
    expect(r.mode).not.toBe('pct_max')
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd web && npx jest __tests__/lib/health/hr-zones.test.ts --no-coverage -t "getRecommendedHeartRateZoneMode"
```

Expected : FAIL — `getRecommendedHeartRateZoneMode is not a function`.

- [ ] **Step 3 : Ajouter la fonction à `web/lib/health/hr-zones.ts`**

Ajouter à la fin du fichier (après la fonction `calculateHrZones`) :

```typescript
export type HrZoneRecommendation = {
  mode:          HrZoneMethod
  confidence:    'high' | 'good' | 'medium' | 'low' | 'very_low' | null
  canCompute:    boolean
  missingFields: string[]
}

export function getRecommendedHeartRateZoneMode(profile: {
  max_hr?:              number | null
  aerobic_threshold_hr?: number | null
  threshold_hr?:        number | null
  resting_hr?:          number | null
  birth_year?:          number | null
}): HrZoneRecommendation {
  const { max_hr, aerobic_threshold_hr, threshold_hr, resting_hr, birth_year } = profile

  if (max_hr && aerobic_threshold_hr && threshold_hr)
    return { mode: 'seuils',   confidence: 'high',     canCompute: true,  missingFields: [] }
  if (max_hr && threshold_hr)
    return { mode: 'test30',   confidence: 'good',     canCompute: true,  missingFields: [] }
  if (max_hr && resting_hr)
    return { mode: 'karvonen', confidence: 'medium',   canCompute: true,  missingFields: [] }
  if (max_hr)
    return { mode: 'pct_max',  confidence: 'low',      canCompute: true,  missingFields: [] }
  if (birth_year)
    return { mode: 'auto',     confidence: 'very_low', canCompute: true,  missingFields: ['FC max'] }

  return { mode: 'pct_max', confidence: null, canCompute: false, missingFields: ['FC max'] }
}
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
cd web && npx jest __tests__/lib/health/hr-zones.test.ts --no-coverage
```

Expected : tous PASS.

- [ ] **Step 5 : Commit**

```bash
cd web && git add lib/health/hr-zones.ts __tests__/lib/health/hr-zones.test.ts
git commit -m "feat(hr-zones): add getRecommendedHeartRateZoneMode with priority logic"
```

---

## Task 3 — `HeartRateZoneDistributionResult` (estimation avg+max)

**Files:**
- Create: `web/lib/health/hr-distribution.ts`
- Create: `web/__tests__/lib/health/hr-distribution.test.ts`

### Context

Sans HR streams ni laps, on ne peut pas calculer le vrai temps par zone. On peut seulement
*estimer* via la loi normale tronquée (µ=avg_hr, σ≈(max_hr−avg_hr)/2). Le résultat doit
être clairement marqué `confidence: 'low'` et `source: 'avg_max_estimate'`.

- [ ] **Step 1 : Écrire les tests**

Créer `web/__tests__/lib/health/hr-distribution.test.ts` :

```typescript
import {
  estimateHrZoneDistribution,
  type HeartRateZoneDistributionResult,
} from '@/lib/health/hr-distribution'
import { calculateHrZones } from '@/lib/health/hr-zones'

const zones = calculateHrZones({ method: 'karvonen', maxHr: 195, restingHr: 57 }).zones

describe('estimateHrZoneDistribution — no HR data', () => {
  it('returns source=none and confidence=none when no HR', () => {
    const r = estimateHrZoneDistribution({ avgHr: null, maxHr: null, durationSec: 3600, zones })
    expect(r.source).toBe('none')
    expect(r.confidence).toBe('none')
    expect(r.zones).toHaveLength(0)
    expect(r.warnings).toContain('Pas de données FC disponibles.')
  })
})

describe('estimateHrZoneDistribution — avg+max estimate', () => {
  const r = estimateHrZoneDistribution({ avgHr: 155, maxHr: 175, durationSec: 3600, zones })

  it('source = avg_max_estimate', () => expect(r.source).toBe('avg_max_estimate'))
  it('confidence = low', () => expect(r.confidence).toBe('low'))
  it('has 5 zones', () => expect(r.zones).toHaveLength(5))
  it('all zones estimated = true', () => r.zones.forEach(z => expect(z.estimated).toBe(true)))
  it('zone percents sum to ~100', () => {
    const sum = r.zones.reduce((acc, z) => acc + z.percent, 0)
    expect(sum).toBeGreaterThanOrEqual(99)
    expect(sum).toBeLessThanOrEqual(101)
  })
  it('zone seconds sum to durationSec', () => {
    const sum = r.zones.reduce((acc, z) => acc + z.seconds, 0)
    expect(sum).toBe(3600)
  })
  it('includes fiability warning', () => {
    expect(r.warnings.some(w => w.includes('FC moyenne'))).toBe(true)
  })
  it('zone with avg_hr has highest share', () => {
    // avgHr=155 is in Z3 (155-167 in karvonen 195/57)
    const z3 = r.zones.find(z => z.zone === 3)!
    expect(z3.percent).toBeGreaterThan(20)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd web && npx jest __tests__/lib/health/hr-distribution.test.ts --no-coverage
```

Expected : FAIL — module not found.

- [ ] **Step 3 : Créer `web/lib/health/hr-distribution.ts`**

```typescript
import type { HrZone } from './hr-zones'

export type HeartRateZoneDistributionResult = {
  source:     'hr_stream' | 'laps' | 'avg_max_estimate' | 'none'
  confidence: 'high' | 'medium' | 'low' | 'none'
  zones: {
    zone:      1 | 2 | 3 | 4 | 5
    seconds:   number
    percent:   number
    estimated: boolean
  }[]
  warnings: string[]
}

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const r = 1 - p * Math.exp(-x * x)
  return x >= 0 ? r : -r
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

export function estimateHrZoneDistribution(params: {
  avgHr:      number | null | undefined
  maxHr:      number | null | undefined
  durationSec: number
  zones:      HrZone[]
}): HeartRateZoneDistributionResult {
  const { avgHr, maxHr, durationSec, zones } = params

  if (!avgHr || !maxHr || zones.length === 0) {
    return {
      source:     'none',
      confidence: 'none',
      zones:      [],
      warnings:   ['Pas de données FC disponibles.'],
    }
  }

  const sigma = Math.max((maxHr - avgHr) / 2, 1)

  const raw = zones.map(z => {
    const lo = z.min ?? 0
    const hi = z.max
    const p  = normalCdf((hi - avgHr) / sigma) - normalCdf((lo - avgHr) / sigma)
    return Math.max(p, 0)
  })

  const total = raw.reduce((a, b) => a + b, 0)
  const percents = raw.map(p => (total > 0 ? p / total : 1 / zones.length))

  // Distribute seconds; last zone absorbs rounding residue
  let remaining = durationSec
  const zoneSeconds = percents.map((pct, i) => {
    if (i === percents.length - 1) return remaining
    const s = Math.round(durationSec * pct)
    remaining -= s
    return s
  })

  return {
    source:     'avg_max_estimate',
    confidence: 'low',
    zones: zones.map((z, i) => ({
      zone:      z.zone as 1 | 2 | 3 | 4 | 5,
      seconds:   zoneSeconds[i],
      percent:   Math.round(percents[i] * 100),
      estimated: true,
    })),
    warnings: [
      'Temps en zones estimé à partir de la FC moyenne et FC max activité. Fiabilité faible.',
      'Ne pas utiliser pour des décisions fortes de coaching.',
    ],
  }
}
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
cd web && npx jest __tests__/lib/health/hr-distribution.test.ts --no-coverage
```

Expected : tous PASS.

- [ ] **Step 5 : Commit**

```bash
cd web && git add lib/health/hr-distribution.ts __tests__/lib/health/hr-distribution.test.ts
git commit -m "feat(hr-distribution): add HeartRateZoneDistributionResult with avg_max_estimate"
```

---

## Task 4 — Fix Intensity : nouveaux types, keywords, suppression fallback CES

**Files:**
- Modify: `web/lib/activities/intensity.ts`
- Modify: `web/__tests__/activities/intensity.test.ts`
- Modify: `web/components/ui/ActivityCard.tsx` (retirer arg `ces`)
- Modify: `web/components/ui/EditActivityModal.tsx` (retirer arg `ces`)
- Modify: `web/app/(main)/activities/[id]/ActivityDetailClient.tsx` (retirer arg `ces`)
- Modify: `web/app/(main)/activities/ActivitiesClient.tsx` (retirer arg `ces`)

### Context

Problèmes actuels :
1. `zoneToIntensity` : Z3 → `'sortie_longue'` (faux — sortie_longue n'est pas une intensité)
2. `guessIntensity` : fallback CES (`ces > 120 → seuil`) est faux (charge ≠ intensité)
3. Ordre des keywords : `'footing 10x400'` → `'footing'` au lieu de `'vma'`
4. `'course à pied facile'` → `'course'` (faux — "course à pied" = running en français)
5. Pas de distinction entre intensité cardiaque et type de séance

**Nouveau modèle :**
- `IntensityKey` étendu : ajouter `'recuperation'` et `'endurance_active'` (rétro-compatible avec les 4 composants UI qui l'utilisent)
- `WorkoutType` : nouveau type pour les séances — `sortie_longue | fractionne | cotes | course | runtaf | velotaf | autre`
- `guessIntensity` : supprime le paramètre `ces`, retourne `IntensityKey`
- `guessWorkoutType` : nouvelle fonction, retourne `WorkoutType`
- Les 4 composants UI appellent `guessIntensity(name, ces, sport, ...)` → changer en `guessIntensity(name, sport, ...)`

- [ ] **Step 1 : Réécrire les tests**

Remplacer **complètement** `web/__tests__/activities/intensity.test.ts`.
Note : `guessIntensity` n'a plus le paramètre `ces` (2e position), `sport` passe en 2e position.

```typescript
import {
  guessIntensity,
  guessWorkoutType,
  secondsToHMS,
  hmsToSeconds,
  INTENSITY_OPTIONS,
  SPORT_OPTIONS,
  type WorkoutType,
} from '@/lib/activities/intensity'
import { calculateHrZones } from '@/lib/health/hr-zones'

describe('secondsToHMS', () => {
  it('converts seconds to h:mm:ss', () => {
    expect(secondsToHMS(4920)).toBe('1:22:00')
    expect(secondsToHMS(3600)).toBe('1:00:00')
    expect(secondsToHMS(90)).toBe('0:01:30')
    expect(secondsToHMS(0)).toBe('0:00:00')
  })
})

describe('hmsToSeconds', () => {
  it('parses h:mm:ss to seconds', () => {
    expect(hmsToSeconds('1:22:00')).toBe(4920)
    expect(hmsToSeconds('0:01:30')).toBe(90)
    expect(hmsToSeconds('1:00:00')).toBe(3600)
  })
  it('returns null for invalid format', () => {
    expect(hmsToSeconds('82:00')).toBeNull()
    expect(hmsToSeconds('abc')).toBeNull()
    expect(hmsToSeconds('')).toBeNull()
  })
})

// ─── guessIntensity ───────────────────────────────────────────────────────────
// Nouvelle signature : guessIntensity(name, sport, avgHr?, hrZones?)
// Le paramètre "ces" a été supprimé (2e position dans l'ancienne signature)

describe('guessIntensity — keyword priority (highest intensity wins)', () => {
  it('"footing 10x400" → vma (fractionné beats footing)', () => {
    expect(guessIntensity('Footing 10x400', 'Run')).toBe('vma')
  })
  it('"Sortie longue EF" → footing (EF keyword = footing intensity)', () => {
    expect(guessIntensity('Sortie longue EF', 'Run')).toBe('footing')
  })
  it('vma/fractionné keywords → vma', () => {
    expect(guessIntensity('VMA 400m x8', 'Run')).toBe('vma')
    expect(guessIntensity('Séance fractionné', 'Run')).toBe('vma')
    expect(guessIntensity('Intervals 1000m', 'Run')).toBe('vma')
    expect(guessIntensity('Répétitions 200m', 'Run')).toBe('vma')
    expect(guessIntensity('Repetition 800m', 'Run')).toBe('vma')
  })
  it('seuil/tempo keywords → seuil', () => {
    expect(guessIntensity('Seuil 20min', 'Run')).toBe('seuil')
    expect(guessIntensity('Tempo run', 'Run')).toBe('seuil')
    expect(guessIntensity('Threshold workout', 'Run')).toBe('seuil')
  })
  it('récup keywords → recuperation', () => {
    expect(guessIntensity('Récup légère', 'Run')).toBe('recuperation')
    expect(guessIntensity('Recovery jog', 'Run')).toBe('recuperation')
  })
  it('footing/EF keywords → footing', () => {
    expect(guessIntensity('Footing matinal', 'Run')).toBe('footing')
    expect(guessIntensity('Endurance facile', 'Run')).toBe('footing')
  })
})

describe('guessIntensity — no CES fallback', () => {
  it('no keywords + no zones → autre (not seuil)', () => {
    expect(guessIntensity('Sortie', 'Run')).toBe('autre')
  })
  it('returns autre when no keywords and no zones', () => {
    expect(guessIntensity('Sortie du matin', 'Run')).toBe('autre')
  })
})

describe('guessIntensity — HR zone fallback', () => {
  const zones = calculateHrZones({ method: 'karvonen', maxHr: 195, restingHr: 57 }).zones
  // Z1: null–140  Z2: 141–154  Z3: 155–167  Z4: 168–181  Z5: 182–195

  it('Z1 → recuperation', () => {
    expect(guessIntensity('Sortie', 'Run', 120, zones)).toBe('recuperation')
    expect(guessIntensity('Sortie', 'Run', 140, zones)).toBe('recuperation')
  })
  it('Z2 → footing', () => {
    expect(guessIntensity('Sortie', 'Run', 148, zones)).toBe('footing')
    expect(guessIntensity('Sortie', 'Run', 154, zones)).toBe('footing')
  })
  it('Z3 → endurance_active (not sortie_longue)', () => {
    expect(guessIntensity('Sortie', 'Run', 160, zones)).toBe('endurance_active')
    expect(guessIntensity('Sortie', 'Run', 167, zones)).toBe('endurance_active')
  })
  it('Z4 → seuil', () => {
    expect(guessIntensity('Sortie', 'Run', 174, zones)).toBe('seuil')
    expect(guessIntensity('Sortie', 'Run', 181, zones)).toBe('seuil')
  })
  it('Z5 → vma', () => {
    expect(guessIntensity('Sortie', 'Run', 188, zones)).toBe('vma')
  })
  it('keywords take priority over HR zones', () => {
    expect(guessIntensity('Footing matinal', 'Run', 188, zones)).toBe('footing')
    expect(guessIntensity('VMA 400m', 'Run', 120, zones)).toBe('vma')
  })
  it('falls back to autre when avgHr null and no zones', () => {
    expect(guessIntensity('Sortie', 'Run', null, [])).toBe('autre')
  })
})

// ─── guessWorkoutType ─────────────────────────────────────────────────────────

describe('guessWorkoutType', () => {
  it('fractionné/VMA keywords → fractionne', () => {
    expect(guessWorkoutType('VMA 400m x8', 'Run')).toBe('fractionne')
    expect(guessWorkoutType('Séance fractionné 200m', 'Run')).toBe('fractionne')
    expect(guessWorkoutType('Intervals 1000m', 'Run')).toBe('fractionne')
  })
  it('côtes keywords → cotes', () => {
    expect(guessWorkoutType('Côtes 200m', 'Run')).toBe('cotes')
    expect(guessWorkoutType('Montée répétées', 'Run')).toBe('cotes')
    expect(guessWorkoutType("Côte d'Igny", 'TrailRun')).toBe('cotes')
    expect(guessWorkoutType('Hill repeats', 'Run')).toBe('cotes')
  })
  it('competition keywords → course', () => {
    expect(guessWorkoutType('Race 10k Lyon', 'Run')).toBe('course')
    expect(guessWorkoutType('Semi-marathon Paris', 'Run')).toBe('course')
    expect(guessWorkoutType('Marathon du Médoc', 'Run')).toBe('course')
    expect(guessWorkoutType('Compétition trail', 'TrailRun')).toBe('course')
    expect(guessWorkoutType('Dossard 1234 course', 'Run')).toBe('course')
  })
  it('"course à pied" is NOT a competition', () => {
    expect(guessWorkoutType('Course à pied matinale', 'Run')).not.toBe('course')
    expect(guessWorkoutType('course à pied facile', 'Run')).not.toBe('course')
  })
  it('"10k" alone → course', () => {
    expect(guessWorkoutType('10k facile', 'Run')).toBe('course')
  })
  it('sortie longue keywords → sortie_longue', () => {
    expect(guessWorkoutType('Sortie longue dimanche', 'Run')).toBe('sortie_longue')
    expect(guessWorkoutType('SL 2h trail', 'TrailRun')).toBe('sortie_longue')
    expect(guessWorkoutType('Long run 30k', 'Run')).toBe('sortie_longue')
    expect(guessWorkoutType('LSL du dimanche', 'Run')).toBe('sortie_longue')
  })
  it('runtaf keywords → runtaf', () => {
    expect(guessWorkoutType('Runtaf maison', 'Run')).toBe('runtaf')
    expect(guessWorkoutType('Taf à pied', 'Run')).toBe('runtaf')
    expect(guessWorkoutType('run taf', 'Run')).toBe('runtaf')
  })
  it('velotaf keywords → velotaf', () => {
    expect(guessWorkoutType('Vélotaf boulot', 'Ride')).toBe('velotaf')
    expect(guessWorkoutType('Taf en vélo', 'Ride')).toBe('velotaf')
    expect(guessWorkoutType('Home 🚴🏻', 'Ride')).toBe('velotaf')
  })
  it('default → autre', () => {
    expect(guessWorkoutType('Sortie du matin', 'Run')).toBe('autre')
    expect(guessWorkoutType('Footing matinal', 'Run')).toBe('autre')
  })
})

// ─── Static exports ───────────────────────────────────────────────────────────

describe('INTENSITY_OPTIONS', () => {
  it('has 11 entries (IntensityKey for UI — includes recuperation + endurance_active)', () => {
    expect(INTENSITY_OPTIONS).toHaveLength(11)
  })
})

describe('SPORT_OPTIONS', () => {
  it('has 10 entries', () => {
    expect(SPORT_OPTIONS).toHaveLength(10)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd web && npx jest __tests__/activities/intensity.test.ts --no-coverage
```

Expected : plusieurs FAIL (`guessWorkoutType` non défini, Z3 retourne `sortie_longue`, CES fallback, etc.).

- [ ] **Step 3 : Réécrire `web/lib/activities/intensity.ts`**

```typescript
import type { HrZone } from '@/lib/health/hr-zones'
import { hrZoneForAvgHr } from '@/lib/health/hr-zones'

// ─── Types publics ───────────────────────────────────────────────────────────

/**
 * Catégorie de sélection manuelle utilisateur (UI dropdown) + valeurs calculées.
 * Étendu par rapport à l'original : + 'recuperation' + 'endurance_active'.
 */
export type IntensityKey =
  | 'recuperation' | 'footing' | 'endurance_active'
  | 'sortie_longue' | 'cotes' | 'vma'
  | 'seuil' | 'runtaf' | 'velotaf' | 'course' | 'autre'

/** Type de séance déduit du nom de l'activité — orthogonal à l'intensité cardiaque */
export type WorkoutType =
  | 'sortie_longue'
  | 'fractionne'
  | 'cotes'
  | 'course'
  | 'runtaf'
  | 'velotaf'
  | 'autre'

export type IntensityOption = { key: IntensityKey; label: string }
export type SportOption     = { value: string; label: string }

// ─── Constantes UI ───────────────────────────────────────────────────────────

export const INTENSITY_OPTIONS: IntensityOption[] = [
  { key: 'recuperation',   label: '😴 Récupération'   },
  { key: 'footing',        label: '🦶 Footing / EF'   },
  { key: 'endurance_active', label: '🔄 Endurance active' },
  { key: 'sortie_longue',  label: '🐢 Sortie longue'  },
  { key: 'cotes',          label: '⛰️ Côtes'           },
  { key: 'vma',            label: '🔥 VMA'             },
  { key: 'seuil',          label: '🎯 Seuil'           },
  { key: 'runtaf',         label: '🏃‍♂️🏢 Runtaf'   },
  { key: 'velotaf',        label: '🚴🏻🏢 Vélotaf'  },
  { key: 'course',         label: '🏁 Course'          },
  { key: 'autre',          label: '❓ Autre'            },
]

export const SPORT_OPTIONS: SportOption[] = [
  { value: 'Run',            label: 'Running'         },
  { value: 'TrailRun',       label: 'Trail'           },
  { value: 'Walk',           label: 'Marche'          },
  { value: 'Hike',           label: 'Randonnée'       },
  { value: 'Ride',           label: 'Vélo'            },
  { value: 'VirtualRide',    label: 'Vélo virtuel'    },
  { value: 'EBikeRide',      label: 'Vélo électrique' },
  { value: 'Swim',           label: 'Natation'        },
  { value: 'WeightTraining', label: 'Muscu'           },
  { value: 'Workout',        label: 'Autre'           },
]

// ─── Utilitaires temps ───────────────────────────────────────────────────────

export function secondsToHMS(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function hmsToSeconds(hms: string): number | null {
  const match = hms.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
}

// ─── Mapping zone → intensité ─────────────────────────────────────────────────

function zoneToIntensity(zone: number): Intensity {
  if (zone <= 1) return 'recuperation'
  if (zone === 2) return 'footing'
  if (zone === 3) return 'endurance_active'
  if (zone === 4) return 'seuil'
  return 'vma'
}

// ─── guessIntensity ───────────────────────────────────────────────────────────

/**
 * Retourne l'intensité cardiaque estimée d'une activité.
 * Priorité : keywords intensité → zone FC → autre.
 * Ne jamais utiliser le CES comme proxy d'intensité.
 * Signature v2 : le paramètre "ces" (ancienne 2e position) est supprimé.
 */
export function guessIntensity(
  name:     string,
  sport:    string,
  avgHr?:   number | null,
  hrZones?: HrZone[],
): IntensityKey {
  const n = name.toLowerCase()

  // 1. VMA / fractionné (intensité la plus haute → prioritaire)
  if (/\b(200|300|400|500|800|1000)\b/.test(n)
      || n.includes('vma') || n.includes('interval') || n.includes('fractionné')
      || n.includes('fractionnée') || n.includes('répétition') || n.includes('repetition'))
    return 'vma'

  // 2. Seuil / tempo
  if (n.includes('seuil') || n.includes('tempo') || n.includes('threshold'))
    return 'seuil'

  // 3. Récupération
  if (n.includes('récup') || n.includes('recovery'))
    return 'recuperation'

  // 4. Footing / endurance facile
  if (n.includes('footing') || n.includes(' ef ') || n.includes('endurance facile'))
    return 'footing'

  // 5. Zone FC depuis avg_hr
  if (avgHr != null && hrZones && hrZones.length > 0) {
    const zone = hrZoneForAvgHr(avgHr, hrZones)
    if (zone !== null) return zoneToIntensity(zone)
  }

  return 'autre'
}

// ─── guessWorkoutType ─────────────────────────────────────────────────────────

/**
 * Retourne le type de séance déduit du nom de l'activité.
 * Orthogonal à l'intensité : une sortie longue peut être footing OU endurance_active.
 */
export function guessWorkoutType(name: string, sport: string): WorkoutType {
  const n = name.toLowerCase()

  // 1. Fractionné / intervalles
  if (/\b(200|300|400|500|800|1000)\b/.test(n)
      || n.includes('vma') || n.includes('interval') || n.includes('fractionné')
      || n.includes('fractionnée') || n.includes('répétition') || n.includes('repetition'))
    return 'fractionne'

  // 2. Côtes / montées
  if (n.includes('côtes') || n.includes('cotes') || n.includes('côte') || n.includes('cote')
      || n.includes('montée') || n.includes('montee') || n.includes('hill'))
    return 'cotes'

  // 3. Compétition — exclure "course à pied" (= running en français, pas une race)
  const isCourseAPied = n.includes('course à pied') || n.includes('course a pied')
  if (!isCourseAPied) {
    if (n.includes('race') || n.includes('compét') || n.includes('compet')
        || n.includes('dossard') || n.includes('chrono') || n.includes(' pb ')
        || n.includes(' pr ') || /\b10k\b/.test(n) || n.includes('semi')
        || n.includes('marathon'))
      return 'course'
  }

  // 4. Sortie longue
  if (n.includes('sortie longue') || /\bsl\b/.test(n) || n.includes('long run') || n.includes('lsl'))
    return 'sortie_longue'

  // 5. Runtaf
  if (n.includes('runtaf') || n.includes('run taf')
      || (n.includes('taf') && sport === 'Run'))
    return 'runtaf'

  // 6. Vélotaf
  if (n.includes('vélotaf') || n.includes('velotaf') || n.includes('vélo taf')
      || name.includes('Home 🚴🏻') || name.includes('🚴🏻 Home')
      || (n.includes('taf') && (sport === 'Ride' || sport === 'EBikeRide')))
    return 'velotaf'

  return 'autre'
}
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
cd web && npx jest __tests__/activities/intensity.test.ts --no-coverage
```

Expected : tous PASS.

- [ ] **Step 5 : Mettre à jour les 4 callers UI — supprimer le paramètre `ces`**

Les 4 fichiers appellent `guessIntensity(name, ces, sport, ...)`. Supprimer l'argument `ces` (2e position).

**`web/components/ui/EditActivityModal.tsx` ligne ~107 :**

Remplacer :
```typescript
(a.manual_intensity as IntensityKey | null) ?? guessIntensity(a.name, a.ces, effectiveSport)
```
Par :
```typescript
(a.manual_intensity as IntensityKey | null) ?? guessIntensity(a.name, effectiveSport)
```

**`web/components/ui/ActivityCard.tsx` ligne ~159 :**

Remplacer :
```typescript
const intensityKey = (a.manual_intensity as string | null) ?? guessIntensity(a.name, a.ces, effectiveSport, a.avg_hr, hrZones)
```
Par :
```typescript
const intensityKey = (a.manual_intensity as string | null) ?? guessIntensity(a.name, effectiveSport, a.avg_hr, hrZones)
```

**`web/app/(main)/activities/[id]/ActivityDetailClient.tsx` ligne ~300 :**

Remplacer :
```typescript
const intensityKey = a.manual_intensity ?? guessIntensity(a.name, a.ces, effectiveSport, a.avg_hr, hrZones)
```
Par :
```typescript
const intensityKey = a.manual_intensity ?? guessIntensity(a.name, effectiveSport, a.avg_hr, hrZones)
```

**`web/app/(main)/activities/ActivitiesClient.tsx` ligne ~574 :**

Remplacer :
```typescript
const key = (a.manual_intensity ?? guessIntensity(a.name, a.ces, a.manual_sport_type ?? a.sport_type, a.avg_hr, hrZones))
```
Par :
```typescript
const key = (a.manual_intensity ?? guessIntensity(a.name, a.manual_sport_type ?? a.sport_type, a.avg_hr, hrZones))
```

- [ ] **Step 6 : Vérifier que tous les tests passent + TypeScript OK**

```bash
cd web && npx jest --no-coverage && npx tsc --noEmit
```

Expected : tous PASS, 0 erreur TypeScript.

- [ ] **Step 7 : Commit**

```bash
cd web && git add lib/activities/intensity.ts __tests__/activities/intensity.test.ts \
               components/ui/ActivityCard.tsx components/ui/EditActivityModal.tsx \
               "app/(main)/activities/[id]/ActivityDetailClient.tsx" \
               "app/(main)/activities/ActivitiesClient.tsx"
git commit -m "feat(intensity): add WorkoutType, fix Z3→endurance_active, remove CES fallback, fix keyword priority, update callers"
```

---

## Task 5 — DB migrations

**Files:**
- Create: `web/supabase/migrations/005_profile_threshold_pace.sql`
- Create: `web/supabase/migrations/006_activity_effort_score_version.sql`

### Context

Pour le CES v2 profile-aware, il faut stocker l'allure seuil personnalisée par sport dans `profiles`,
et tracer la version du calcul dans `activities` pour savoir quelles activités doivent être recalculées.

- [ ] **Step 1 : Créer `web/supabase/migrations/005_profile_threshold_pace.sql`**

```sql
-- 005_profile_threshold_pace.sql
-- Allure seuil personnalisée par sport (secondes par km)
-- NULL = utiliser la valeur par défaut du sport config
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS threshold_pace_run_sec_per_km   integer,
  ADD COLUMN IF NOT EXISTS threshold_pace_trail_sec_per_km integer;

COMMENT ON COLUMN profiles.threshold_pace_run_sec_per_km
  IS 'Allure seuil course à pied en s/km (ex: 270 = 4:30/km). NULL = défaut config.';
COMMENT ON COLUMN profiles.threshold_pace_trail_sec_per_km
  IS 'Allure seuil trail en s/km. NULL = défaut config.';
```

- [ ] **Step 2 : Créer `web/supabase/migrations/006_activity_effort_score_version.sql`**

```sql
-- 006_activity_effort_score_version.sql
-- Traçabilité du calcul CES pour permettre le recalcul sélectif
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS effort_score_version    text,
  ADD COLUMN IF NOT EXISTS effort_score_updated_at timestamptz;

COMMENT ON COLUMN activities.effort_score_version
  IS 'Version du modèle CES utilisé pour calculer ces (ex: v2.0-pace-threshold-user).';
COMMENT ON COLUMN activities.effort_score_updated_at
  IS 'Horodatage du dernier calcul CES sur cette activité.';
```

- [ ] **Step 3 : Appliquer les migrations en local (si Supabase local est actif)**

```bash
cd web && npx supabase db push --local 2>/dev/null || echo "Supabase local non actif — appliquer via dashboard"
```

Les migrations seront appliquées automatiquement lors du prochain déploiement Vercel via Supabase CI.

- [ ] **Step 4 : Mettre à jour `web/app/api/profile/route.ts` — autoriser les nouveaux champs**

Ouvrir `web/app/api/profile/route.ts`. Localiser le tableau `ALLOWED_FIELDS` (ligne ~10) et ajouter les deux nouveaux champs :

Remplacer :
```typescript
const ALLOWED_FIELDS = [
  'first_name', 'last_name', 'max_hr', 'threshold_hr', 'resting_hr',
  'aerobic_threshold_hr', 'ftp_watts', 'weight_kg', 'year_goal_km', 'birth_year'
]
```

Par :
```typescript
const ALLOWED_FIELDS = [
  'first_name', 'last_name', 'max_hr', 'threshold_hr', 'resting_hr',
  'aerobic_threshold_hr', 'ftp_watts', 'weight_kg', 'year_goal_km', 'birth_year',
  'threshold_pace_run_sec_per_km', 'threshold_pace_trail_sec_per_km',
]
```

- [ ] **Step 5 : Commit**

```bash
cd web && git add supabase/migrations/005_profile_threshold_pace.sql \
               supabase/migrations/006_activity_effort_score_version.sql \
               app/api/profile/route.ts
git commit -m "feat(db): add threshold_pace columns to profiles + effort_score_version to activities"
```

---

## Task 6 — CES v2 : profile-aware avec confidence / warnings

**Files:**
- Modify: `web/lib/analytics/types.ts`
- Modify: `web/lib/analytics/effort-score.ts`
- Modify: `web/__tests__/analytics/effort-score.test.ts`

### Context

`computeCesResult(activity)` ignore le profil utilisateur. Sans profil, le FTP vélo est hard-codé
à 220W et l'allure seuil run à 5:00/km. La nouvelle version :
- Accepte un profil optionnel
- Utilise `ftp_watts` si disponible (vélo)
- Utilise `threshold_pace_run/trail_sec_per_km` si disponibles
- Retourne `model`, `confidence`, `components`, `warnings`, `version`
- Garantit que 1h run plat au seuil utilisateur ≈ 100 CES (propriété mathématique déjà vraie)
- Marque trail avec D+ comme `confidence ≤ medium`

- [ ] **Step 1 : Écrire les tests d'échec**

Ajouter à `web/__tests__/analytics/effort-score.test.ts` :

```typescript
import { computeCesResult, normalizeSportType, type ActivityInput } from '@/lib/analytics/effort-score'

// ... (garder les tests existants)

describe('CES v2 — profile-aware', () => {
  const BASE_RUN: ActivityInput = {
    id: '1', rawSportType: 'Run', name: 'Run', startDate: '2026-05-08',
    movingTimeSeconds: 3600, distanceMeters: 12000, elevationGainMeters: 0,
  }

  it('1h run flat at threshold pace → CES ≈ 100 (±5)', () => {
    // threshold_pace = 300 s/km, distance at 300s/km for 1h = 12000m
    const profile = { threshold_pace_run_sec_per_km: 300 }
    const r = computeCesResult(BASE_RUN, profile)
    expect(r.ces).toBeGreaterThanOrEqual(95)
    expect(r.ces).toBeLessThanOrEqual(105)
  })

  it('uses user ftp_watts for cycling (not default 220W)', () => {
    const activity: ActivityInput = {
      id: '2', rawSportType: 'Ride', name: 'Ride', startDate: '2026-05-08',
      movingTimeSeconds: 3600, averageWatts: 200, elevationGainMeters: 0,
    }
    const withUserFtp   = computeCesResult(activity, { ftp_watts: 200 })
    const withDefaultFtp = computeCesResult(activity)
    // At 200W with ftp=200: IF=1.0 (full threshold). With default 220W: IF≈0.91
    expect(withUserFtp.ces).toBeGreaterThan(withDefaultFtp.ces)
    expect(withUserFtp.components.thresholdSource).toContain('utilisateur')
  })

  it('run without user threshold_pace produces warning', () => {
    const r = computeCesResult(BASE_RUN)
    expect(r.warnings.some(w => w.includes('allure seuil'))).toBe(true)
    expect(r.confidence).toBe('low')
  })

  it('run with user threshold_pace has higher confidence', () => {
    const r = computeCesResult(BASE_RUN, { threshold_pace_run_sec_per_km: 300 })
    expect(r.confidence).toBe('high')
    expect(r.warnings.filter(w => w.includes('allure seuil'))).toHaveLength(0)
  })

  it('trail with D+ — confidence ≤ medium + descent warning', () => {
    const trail: ActivityInput = {
      id: '3', rawSportType: 'TrailRun', name: 'Trail', startDate: '2026-05-08',
      movingTimeSeconds: 7200, distanceMeters: 20000, elevationGainMeters: 1000,
    }
    const r = computeCesResult(trail, { threshold_pace_trail_sec_per_km: 360 })
    expect(['medium', 'low']).toContain(r.confidence)
    expect(r.warnings.some(w => w.includes('D+'))).toBe(true)
  })

  it('result includes version string', () => {
    const r = computeCesResult(BASE_RUN)
    expect(typeof r.version).toBe('string')
    expect(r.version.startsWith('v')).toBe(true)
  })

  it('result includes model field', () => {
    const r = computeCesResult(BASE_RUN, { threshold_pace_run_sec_per_km: 300 })
    expect(['power', 'pace_threshold', 'pace_effort_distance', 'hr_proxy', 'legacy']).toContain(r.model)
  })

  it('components includes durationHours and elevationFactor', () => {
    const r = computeCesResult(BASE_RUN, { threshold_pace_run_sec_per_km: 300 })
    expect(r.components.durationHours).toBeCloseTo(1.0, 1)
    expect(r.components.elevationFactor).toBe(1.0)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd web && npx jest __tests__/analytics/effort-score.test.ts --no-coverage
```

Expected : FAIL — `profile` non accepté, `r.warnings` undefined, etc.

- [ ] **Step 3 : Étendre `web/lib/analytics/types.ts`**

Remplacer complètement le fichier :

```typescript
export type SportCategory =
  | 'run' | 'trail_run' | 'walk' | 'hike'
  | 'road_ride' | 'gravel_ride' | 'mountain_bike' | 'indoor_ride'
  | 'swim' | 'strength' | 'mobility' | 'cardio_other' | 'other'

export type EffortLabel =
  | 'recovery' | 'endurance' | 'steady' | 'intense' | 'very_hard' | 'extreme'

export type CesModel =
  | 'power'
  | 'pace_threshold'
  | 'pace_effort_distance'
  | 'hr_proxy'
  | 'legacy'

export type CesConfidence = 'high' | 'medium' | 'low'

export type ActivityInput = {
  id:                    string
  rawSportType:          string
  name?:                 string
  startDate:             string
  movingTimeSeconds:     number
  elapsedTimeSeconds?:   number
  distanceMeters?:       number
  elevationGainMeters?:  number
  averageHeartrate?:     number
  maxHeartrate?:         number
  averageWatts?:         number
  normalizedPowerWatts?: number
  calories?:             number
  perceivedEffort?:      number
}

export type UserProfileForCes = {
  max_hr?:                          number | null
  resting_hr?:                      number | null
  threshold_hr?:                    number | null
  ftp_watts?:                       number | null
  threshold_pace_run_sec_per_km?:   number | null
  threshold_pace_trail_sec_per_km?: number | null
}

export type CesResult = {
  // Champs originaux (compatibilité)
  ces:             number
  cardioLoad:      number
  muscleLoad:      number
  label:           EffortLabel
  intensityFactor: number
  // Champs v2
  model:           CesModel
  confidence:      CesConfidence
  components: {
    durationHours:    number
    intensityFactor:  number
    thresholdSource:  string
    elevationFactor:  number
    sportFactor:      number
  }
  warnings:        string[]
  version:         string
}

export type SportConfig = {
  sportBase:             number
  sportFactor:           number
  defaultIF:             number
  minIF:                 number
  maxIF:                 number
  elevationSensitivity:  number
  thresholdPaceSecPerKm: number | null
  thresholdPower:        number | null
}
```

- [ ] **Step 4 : Réécrire `web/lib/analytics/effort-score.ts`**

```typescript
import type {
  ActivityInput, CesResult, CesConfidence, CesModel,
  EffortLabel, SportCategory, SportConfig, UserProfileForCes,
} from './types'

const MUSCLE_LOAD_RATIO = 0.6
const CES_VERSION = 'v2.0'

const SPORT_CONFIGS = {
  run:          { sportBase: 100, sportFactor: 1.00, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 8,  thresholdPaceSecPerKm: 300, thresholdPower: null },
  trail_run:    { sportBase: 100, sportFactor: 1.15, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 12, thresholdPaceSecPerKm: 330, thresholdPower: null },
  walk:         { sportBase:  60, sportFactor: 0.50, defaultIF: 0.50, minIF: 0.3, maxIF: 0.8, elevationSensitivity: 10, thresholdPaceSecPerKm: null, thresholdPower: null },
  hike:         { sportBase:  60, sportFactor: 0.65, defaultIF: 0.55, minIF: 0.3, maxIF: 0.9, elevationSensitivity: 14, thresholdPaceSecPerKm: null, thresholdPower: null },
  road_ride:    { sportBase:  80, sportFactor: 0.75, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 5,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  gravel_ride:  { sportBase:  80, sportFactor: 0.85, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 7,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  mountain_bike:{ sportBase:  90, sportFactor: 1.00, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 9,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  indoor_ride:  { sportBase:  80, sportFactor: 0.70, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  swim:         { sportBase: 120, sportFactor: 1.10, defaultIF: 0.75, minIF: 0.4, maxIF: 1.2, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  strength:     { sportBase:  80, sportFactor: 0.90, defaultIF: 0.70, minIF: 0.4, maxIF: 1.1, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  mobility:     { sportBase:  40, sportFactor: 0.40, defaultIF: 0.50, minIF: 0.2, maxIF: 0.7, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  cardio_other: { sportBase:  80, sportFactor: 0.80, defaultIF: 0.65, minIF: 0.3, maxIF: 1.1, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  other:        { sportBase:  70, sportFactor: 0.70, defaultIF: 0.60, minIF: 0.3, maxIF: 1.0, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
} as const satisfies Record<SportCategory, SportConfig>

export function normalizeSportType(rawSportType: string, name?: string): SportCategory {
  const raw   = rawSportType.toLowerCase()
  const title = (name ?? '').toLowerCase()
  if (raw.includes('trail'))                                                           return 'trail_run'
  if (raw.includes('run'))        return title.includes('trail') ? 'trail_run' : 'run'
  if (raw.includes('walk'))                                                            return 'walk'
  if (raw.includes('hike'))                                                            return 'hike'
  if (raw.includes('gravel'))                                                          return 'gravel_ride'
  if (raw.includes('mountain') || raw.includes('mtb'))                                 return 'mountain_bike'
  if (raw.includes('virtualride') || raw.includes('indoor') || raw.includes('trainer')) return 'indoor_ride'
  if (raw.includes('ride') || raw.includes('bike') || raw.includes('cycling'))         return 'road_ride'
  if (raw.includes('swim'))                                                            return 'swim'
  if (raw.includes('strength') || raw.includes('weight') || raw.includes('muscu'))    return 'strength'
  if (raw.includes('yoga') || raw.includes('mobility') || raw.includes('stretch'))    return 'mobility'
  if (raw.includes('cardio'))                                                          return 'cardio_other'
  return 'other'
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

function effortLabel(ces: number): EffortLabel {
  if (ces <= 30)  return 'recovery'
  if (ces <= 60)  return 'endurance'
  if (ces <= 90)  return 'steady'
  if (ces <= 130) return 'intense'
  if (ces <= 180) return 'very_hard'
  return 'extreme'
}

type IFResult = {
  value:  number
  source: string
  model:  CesModel
}

function calcIF(
  a:       ActivityInput,
  cfg:     SportConfig,
  sport:   SportCategory,
  profile: UserProfileForCes,
): IFResult {
  // ── Cycling : FTP utilisateur ──────────────────────────────────────────────
  if (profile.ftp_watts && cfg.thresholdPower !== null) {
    const ftp = profile.ftp_watts
    if (a.normalizedPowerWatts != null)
      return { value: clamp(a.normalizedPowerWatts / ftp, cfg.minIF, cfg.maxIF), source: `FTP utilisateur ${ftp}W (NP)`, model: 'power' }
    if (a.averageWatts != null)
      return { value: clamp(a.averageWatts / ftp, cfg.minIF, cfg.maxIF), source: `FTP utilisateur ${ftp}W (avg)`, model: 'power' }
  }

  // ── Cycling : FTP par défaut ───────────────────────────────────────────────
  if (cfg.thresholdPower !== null) {
    if (a.normalizedPowerWatts != null)
      return { value: clamp(a.normalizedPowerWatts / cfg.thresholdPower, cfg.minIF, cfg.maxIF), source: `FTP défaut ${cfg.thresholdPower}W (NP)`, model: 'power' }
    if (a.averageWatts != null)
      return { value: clamp(a.averageWatts / cfg.thresholdPower, cfg.minIF, cfg.maxIF), source: `FTP défaut ${cfg.thresholdPower}W (avg)`, model: 'power' }
  }

  const hasPace = a.distanceMeters != null && a.distanceMeters > 200 && a.movingTimeSeconds > 0
  if (!hasPace) return { value: cfg.defaultIF, source: 'Facteur par défaut (pas de distance)', model: 'legacy' }
  const pace = a.movingTimeSeconds / (a.distanceMeters! / 1000)

  // ── Run : allure seuil utilisateur ────────────────────────────────────────
  if (sport === 'run' && profile.threshold_pace_run_sec_per_km)
    return { value: clamp(profile.threshold_pace_run_sec_per_km / pace, cfg.minIF, cfg.maxIF), source: `Allure seuil utilisateur ${profile.threshold_pace_run_sec_per_km}s/km`, model: 'pace_threshold' }
  if (sport === 'trail_run' && profile.threshold_pace_trail_sec_per_km)
    return { value: clamp(profile.threshold_pace_trail_sec_per_km / pace, cfg.minIF, cfg.maxIF), source: `Allure seuil trail utilisateur ${profile.threshold_pace_trail_sec_per_km}s/km`, model: 'pace_threshold' }

  // ── Run/Trail : allure seuil par défaut ───────────────────────────────────
  if (cfg.thresholdPaceSecPerKm !== null)
    return { value: clamp(cfg.thresholdPaceSecPerKm / pace, cfg.minIF, cfg.maxIF), source: `Allure seuil défaut ${cfg.thresholdPaceSecPerKm}s/km`, model: 'pace_threshold' }

  return { value: cfg.defaultIF, source: 'Facteur par défaut', model: 'legacy' }
}

function calcElevationFactor(a: ActivityInput, cfg: SportConfig): number {
  if (cfg.elevationSensitivity <= 0 || !a.distanceMeters || a.distanceMeters <= 0) return 1.0
  const gain    = a.elevationGainMeters ?? 0
  const per100m = (gain / a.distanceMeters) * 100
  return 1.0 + per100m * cfg.elevationSensitivity * 0.01
}

function buildConfidenceAndWarnings(
  sport:     SportCategory,
  ifResult:  IFResult,
  a:         ActivityInput,
  profile:   UserProfileForCes,
): { confidence: CesConfidence; warnings: string[] } {
  const warnings: string[] = []
  let confidence: CesConfidence = 'high'

  // Pas d'allure seuil personnalisée pour run/trail
  if ((sport === 'run' || sport === 'trail_run') && ifResult.model !== 'pace_threshold') {
    warnings.push("Score calculé avec une allure seuil par défaut. Renseigne ton allure seuil pour améliorer la précision.")
    confidence = 'low'
  } else if (sport === 'trail_run' && ifResult.model === 'pace_threshold' && !profile.threshold_pace_trail_sec_per_km) {
    warnings.push("Score trail calculé avec l'allure seuil run. Renseigne une allure seuil trail pour plus de précision.")
    confidence = 'medium'
  }

  // Trail avec D+ uniquement
  if (sport === 'trail_run' && (a.elevationGainMeters ?? 0) > 0) {
    warnings.push("Le score trail utilise uniquement le D+. La descente et la technicité ne sont pas encore pris en compte.")
    if (confidence === 'high') confidence = 'medium'
  }

  // Vélo sans puissance (utilise IF par défaut)
  if (ifResult.model === 'legacy' && (sport === 'road_ride' || sport === 'gravel_ride' || sport === 'mountain_bike' || sport === 'indoor_ride')) {
    warnings.push("Score vélo calculé sans données de puissance. Renseigne ton FTP pour améliorer la précision.")
    confidence = 'low'
  }

  return { confidence, warnings }
}

export function computeCesResult(a: ActivityInput, profile: UserProfileForCes = {}): CesResult {
  const durationHours = Math.max(a.movingTimeSeconds / 3600, 0.01)
  const sport         = normalizeSportType(a.rawSportType, a.name)
  const cfg           = SPORT_CONFIGS[sport]
  const ifResult      = calcIF(a, cfg, sport, profile)
  const elevFactor    = calcElevationFactor(a, cfg)
  const baseScore     = durationHours * cfg.sportBase * (ifResult.value * ifResult.value)
  const finalScore    = baseScore * cfg.sportFactor * elevFactor
  const ces           = Math.round(finalScore)

  const { confidence, warnings } = buildConfidenceAndWarnings(sport, ifResult, a, profile)

  return {
    ces,
    cardioLoad:      Math.round(baseScore * cfg.sportFactor),
    muscleLoad:      Math.round(finalScore * MUSCLE_LOAD_RATIO),
    label:           effortLabel(ces),
    intensityFactor: Math.round(ifResult.value * 100) / 100,
    model:           ifResult.model,
    confidence,
    components: {
      durationHours,
      intensityFactor: ifResult.value,
      thresholdSource: ifResult.source,
      elevationFactor: elevFactor,
      sportFactor:     cfg.sportFactor,
    },
    warnings,
    version: CES_VERSION,
  }
}

export function computeCes(a: ActivityInput, profile?: UserProfileForCes): number {
  return computeCesResult(a, profile).ces
}

export type { ActivityInput, CesResult, EffortLabel, SportCategory, UserProfileForCes }
```

- [ ] **Step 5 : Vérifier que tous les tests passent**

```bash
cd web && npx jest --no-coverage
```

Expected : tous PASS (les tests existants utilisent `computeCesResult(BASE_RUN)` sans profil → fonctionne car `profile={}` par défaut).

- [ ] **Step 6 : Commit**

```bash
cd web && git add lib/analytics/types.ts lib/analytics/effort-score.ts \
               __tests__/analytics/effort-score.test.ts
git commit -m "feat(ces): CES v2 profile-aware — ftp_watts, threshold_pace, confidence, warnings"
```

---

## Task 7 — Recalcul CES + endpoint API

**Files:**
- Create: `web/lib/sync/recalculate-scores.ts`
- Create: `web/app/api/profile/recalculate/route.ts`
- Modify: `web/lib/sync/import-activities.ts`

### Context

Quand l'utilisateur change ses seuils dans le profil, les activités existantes ont un CES calculé avec
les anciens paramètres. Il faut pouvoir recalculer. Stratégie choisie : bouton "Recalculer mes scores"
accessible dans le profil, qui appelle POST `/api/profile/recalculate`.

- [ ] **Step 1 : Lire `web/lib/sync/import-activities.ts` pour comprendre la structure actuelle**

```bash
cat web/lib/sync/import-activities.ts
```

Repérer : comment `computeCesResult` est appelé, quelle est la signature de `importActivities`, comment `toActivityInput` est défini.

- [ ] **Step 2 : Créer `web/lib/sync/recalculate-scores.ts`**

```typescript
import { createServiceClient } from '@/lib/database/supabase-server'
import { computeCesResult } from '@/lib/analytics/effort-score'
import type { UserProfileForCes } from '@/lib/analytics/types'
import type { ActivityInput } from '@/lib/analytics/types'

function toActivityInput(row: Record<string, unknown>): ActivityInput {
  return {
    id:                   String(row.id),
    rawSportType:         String(row.sport_type ?? ''),
    name:                 row.name ? String(row.name) : undefined,
    startDate:            String(row.start_time ?? ''),
    movingTimeSeconds:    Number(row.moving_time_sec ?? row.duration_sec ?? 0),
    elapsedTimeSeconds:   row.duration_sec ? Number(row.duration_sec) : undefined,
    distanceMeters:       row.distance_m ? Number(row.distance_m) : undefined,
    elevationGainMeters:  row.elevation_gain_m ? Number(row.elevation_gain_m) : undefined,
    averageHeartrate:     row.avg_hr ? Number(row.avg_hr) : undefined,
    maxHeartrate:         row.max_hr ? Number(row.max_hr) : undefined,
    averageWatts:         row.avg_power ? Number(row.avg_power) : undefined,
  }
}

export async function recalculateUserEffortScores(userId: string): Promise<{ recalculated: number; errors: number }> {
  const supabase = createServiceClient()

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')
    .eq('id', userId)
    .single()

  const profile: UserProfileForCes = profileRow ?? {}

  const { data: activities } = await supabase
    .from('activities')
    .select('id, sport_type, name, start_time, duration_sec, moving_time_sec, distance_m, elevation_gain_m, avg_hr, max_hr, avg_power')
    .eq('user_id', userId)

  if (!activities?.length) return { recalculated: 0, errors: 0 }

  let recalculated = 0
  let errors = 0
  const now = new Date().toISOString()

  for (const act of activities) {
    try {
      const result = computeCesResult(toActivityInput(act), profile)

      await supabase
        .from('activities')
        .update({ ces: result.ces, effort_score_version: result.version, effort_score_updated_at: now })
        .eq('id', act.id)

      await supabase
        .from('activity_metrics')
        .upsert([
          { activity_id: act.id, metric_key: 'cardioLoad',      metric_value: result.cardioLoad,      computed_at: now },
          { activity_id: act.id, metric_key: 'muscleLoad',      metric_value: result.muscleLoad,      computed_at: now },
          { activity_id: act.id, metric_key: 'intensityFactor', metric_value: result.intensityFactor, computed_at: now },
        ], { onConflict: 'activity_id,metric_key' })

      recalculated++
    } catch {
      errors++
    }
  }

  return { recalculated, errors }
}

export async function recalculateUserFatigue(userId: string): Promise<void> {
  const supabase = createServiceClient()

  // Utiliser les CES déjà stockés en base (recalculateUserEffortScores doit être appelé avant)
  const { data: activities } = await supabase
    .from('activities')
    .select('start_time, ces')
    .eq('user_id', userId)
    .order('start_time', { ascending: true })

  if (!activities?.length) return

  const { buildDailyMetrics } = await import('@/lib/analytics/fatigue')

  // Agréger les CES par jour directement depuis les valeurs stockées
  const map = new Map<string, number>()
  for (const a of activities) {
    const date = String(a.start_time).split('T')[0]
    map.set(date, (map.get(date) ?? 0) + Number(a.ces ?? 0))
  }
  const dailyLoads = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ces]) => ({ date, ces }))

  const metrics = buildDailyMetrics(dailyLoads)
  const now     = new Date().toISOString()

  for (const m of metrics) {
    await supabase
      .from('daily_metrics')
      .upsert({
        user_id: userId, metric_date: m.date,
        atl: m.atl, ctl: m.ctl, tsb: m.tsb, daily_load: m.dailyLoad,
        computed_at: now,
      }, { onConflict: 'user_id,metric_date' })
  }
}
```

- [ ] **Step 3 : Créer `web/app/api/profile/recalculate/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { recalculateUserEffortScores, recalculateUserFatigue } from '@/lib/sync/recalculate-scores'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recalculated, errors } = await recalculateUserEffortScores(user.id)
  await recalculateUserFatigue(user.id)

  return NextResponse.json({ recalculated, errors })
}
```

- [ ] **Step 4 : Mettre à jour `web/lib/sync/import-activities.ts` pour passer le profil**

Ajouter l'import du type en haut du fichier :
```typescript
import type { UserProfileForCes } from '@/lib/analytics/types'
```

Changer la signature de `importActivities` (ligne 25) :
```typescript
// Avant :
export async function importActivities(activities: NormalizedActivity[]): Promise<ImportResult> {
// Après :
export async function importActivities(activities: NormalizedActivity[], profile: UserProfileForCes = {}): Promise<ImportResult> {
```

Changer la ligne qui construit `cesMap` (ligne 30) :
```typescript
// Avant :
const cesMap = new Map<string, CesResult>(
  activities.map((act) => [act.providerActivityId, computeCesResult(toActivityInput(act))])
)
// Après :
const cesMap = new Map<string, CesResult>(
  activities.map((act) => [act.providerActivityId, computeCesResult(toActivityInput(act), profile)])
)
```

Ajouter `effort_score_version` et `effort_score_updated_at` dans le tableau `records` (après `ces:`, ligne ~50) :
```typescript
ces: cesMap.get(act.providerActivityId)!.ces,
effort_score_version:    cesMap.get(act.providerActivityId)!.version,
effort_score_updated_at: new Date().toISOString(),
```

- [ ] **Step 5 : Vérifier que tous les tests passent**

```bash
cd web && npx jest --no-coverage
```

Expected : tous PASS.

- [ ] **Step 6 : Commit**

```bash
cd web && git add lib/sync/recalculate-scores.ts app/api/profile/recalculate/route.ts lib/sync/import-activities.ts
git commit -m "feat(recalculate): add recalculateUserEffortScores + POST /api/profile/recalculate"
```

---

## Task 8 — Fatigue : confidence quand historique < 42 jours

**Files:**
- Modify: `web/lib/analytics/fatigue.ts`
- Modify: `web/__tests__/analytics/fatigue.test.ts`

### Context

`buildDailyMetrics` retourne des métriques sans indiquer si l'historique est suffisant.
Les courbes ATL/CTL/TSB ne sont significatives qu'après 42 jours (= la période CTL).
En dessous, afficher `confidence: 'low'` avec un warning.

- [ ] **Step 1 : Écrire les tests d'échec**

Ajouter à `web/__tests__/analytics/fatigue.test.ts` :

```typescript
import { buildDailyMetrics, buildFatigueResult } from '@/lib/analytics/fatigue'

// ... (garder les tests existants)

describe('buildFatigueResult — confidence', () => {
  function makeDailyLoads(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      ces: 50,
    }))
  }

  it('confidence = low when history < 14 days', () => {
    const r = buildFatigueResult(makeDailyLoads(7))
    expect(r.confidence).toBe('low')
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('confidence = medium when history 14–41 days', () => {
    const r = buildFatigueResult(makeDailyLoads(30))
    expect(r.confidence).toBe('medium')
    expect(r.warnings.some(w => w.includes('42'))).toBe(true)
  })

  it('confidence = high when history ≥ 42 days', () => {
    const r = buildFatigueResult(makeDailyLoads(50))
    expect(r.confidence).toBe('high')
    expect(r.warnings).toHaveLength(0)
  })

  it('metrics array is same as buildDailyMetrics', () => {
    const loads = makeDailyLoads(30)
    const r = buildFatigueResult(loads)
    const direct = buildDailyMetrics(loads)
    expect(r.metrics).toEqual(direct)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd web && npx jest __tests__/analytics/fatigue.test.ts --no-coverage
```

Expected : FAIL — `buildFatigueResult` non défini.

- [ ] **Step 3 : Ajouter `buildFatigueResult` à `web/lib/analytics/fatigue.ts`**

Ajouter à la fin du fichier (après `buildDailyMetrics`) :

```typescript
export type FatigueResult = {
  metrics:    DailyMetrics[]
  confidence: 'high' | 'medium' | 'low'
  warnings:   string[]
}

export function buildFatigueResult(loads: DailyLoad[]): FatigueResult {
  const metrics      = buildDailyMetrics(loads)
  const historyDays  = metrics.length
  const warnings: string[] = []
  let confidence: 'high' | 'medium' | 'low'

  if (historyDays < 14) {
    confidence = 'low'
    warnings.push(`Historique de ${historyDays} jours insuffisant. Les courbes ATL/CTL sont peu fiables.`)
  } else if (historyDays < 42) {
    confidence = 'medium'
    warnings.push(`Historique de ${historyDays} jours. 42 jours minimum pour des courbes CTL stables.`)
  } else {
    confidence = 'high'
  }

  return { metrics, confidence, warnings }
}
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
cd web && npx jest --no-coverage
```

Expected : tous PASS.

- [ ] **Step 5 : Commit**

```bash
cd web && git add lib/analytics/fatigue.ts __tests__/analytics/fatigue.test.ts
git commit -m "feat(fatigue): add buildFatigueResult with confidence when history < 42 days"
```

---

---

## Hors scope de ce plan — Section 11 : UI séparation intensité / charge

La spec demande d'afficher **deux informations séparées** dans les cartes d'activité :
1. `"Z2 — Endurance fondamentale"` (couleur zone)
2. `"CES 135 — Charge élevée"` (couleur charge)

Ces changements touchent des composants React (`ActivityCard.tsx`, `ActivityDetailClient.tsx`) et
nécessitent de vérifier le rendu visuel dans un navigateur. Ils doivent faire l'objet d'une
**tâche UI séparée** après la validation des tâches backend (1-8).

**Prérequis accomplis par ce plan :** `guessIntensity` retourne `IntensityKey` (incluant
`endurance_active`/`recuperation`) et `guessWorkoutType` retourne `WorkoutType`. Les données
sont prêtes — il reste à les afficher.

---

## Livrable final — vérification complète

- [ ] **Run complet de la suite de tests**

```bash
cd web && npx jest --no-coverage --verbose 2>&1 | tail -30
```

Expected : toutes les suites PASS.

- [ ] **Build TypeScript**

```bash
cd web && npx tsc --noEmit
```

Expected : 0 erreur.

---

## Résumé des limites après implémentation

| Limite | Cause | Impact |
|--------|-------|--------|
| Distribution zones = estimation | Pas de HR streams | `confidence: 'low'`, ne pas utiliser pour coaching |
| Trail = D+ uniquement | Pas de D- ni technicité | `confidence ≤ medium` pour trail |
| CES recalcul = bouton manuel | Pas de trigger Supabase automatique | L'utilisateur doit cliquer "Recalculer" |
| Allure seuil trail ≠ allure seuil run | Pas de benchmark trail | Fallback sur config par défaut si non renseigné |
| Zone FC = FC moyenne, pas vraie distribution | Pas de laps | Estimation statistique uniquement |
