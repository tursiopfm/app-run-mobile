# Module Profil FC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre le module FC du profil web avec 7 méthodes de calcul, champs conditionnels, modale protocole test 30, popover info FC repos, et panneau de traçabilité des sources.

**Architecture:** Composant racine `HrCalibrationCard` qui contient `HrZoneMethod` + `HrCardioFields` + bouton sauvegarde, partage l'état entre eux. `HrSourcesPanel` séparé en lecture seule. Suppression de `ProfileSourceSection` et `ProfileCardioSection`. Migration Supabase **010** (et non 006 comme dans la spec — les migrations existantes vont jusqu'à 009).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Supabase, Jest + Testing Library.

**Spec source:** `docs/superpowers/specs/2026-05-11-hr-profile-module-design.md`

**Correction sur la spec — `hr-deduce.ts`** : la table `activities` n'a pas de colonne `min_hr`. La logique de déduction sera donc :
- `maxHrObserved` = max(activities.max_hr) sur 365 jours
- `restingHrEstimated` = lue dans `provider_connections.athlete_data.resting_heart_rate` si présent (Strava la fournit si l'utilisateur l'a renseignée). Sinon null → message UI « Renseigne ta FC repos dans ta montre puis resync ».
- `lthrEstimated` = 90e percentile de `activities.max_hr` filtré sur `moving_time_sec >= 1800` (runs ≥ 30 min)

---

## File Structure

**Files à créer :**

| Chemin | Responsabilité |
|---|---|
| `web/supabase/migrations/010_hr_zone_method.sql` | Ajout colonnes `hr_zone_method`, `hr_zones_custom`, `hr_method_updated_at` |
| `web/lib/health/hr-method-meta.ts` | Source unique : libellés, descriptions, couleurs, champs requis par méthode |
| `web/lib/health/hr-deduce.ts` | Calcul `maxHrObserved` / `restingHrEstimated` / `lthrEstimated` à partir de Supabase |
| `web/__tests__/lib/health/hr-method-meta.test.ts` | Tests data integrity |
| `web/__tests__/lib/health/hr-deduce.test.ts` | Tests calculs déduction |
| `web/components/settings/TestProtocolModal.tsx` | Modale protocole test 30 |
| `web/components/settings/RestingHrInfoPopover.tsx` | Popover « i » FC repos |
| `web/components/settings/CustomZonesEditor.tsx` | Grille Z1-Z5 avec validation live |
| `web/__tests__/components/CustomZonesEditor.test.tsx` | Tests validation zones |
| `web/components/settings/HrCardioFields.tsx` | Affichage conditionnel des champs selon méthode |
| `web/components/settings/HrCalibrationCard.tsx` | Wrapper : méthode + champs + save |
| `web/components/settings/HrSourcesPanel.tsx` | Tableau lecture seule sources des valeurs |

**Files à modifier :**

| Chemin | Modif |
|---|---|
| `web/lib/health/hr-zones.ts` | Ajouter méthode `deduced`, utiliser les valeurs déduites |
| `web/components/settings/HrZoneMethod.tsx` | 7 méthodes, badges couleurs par fiabilité |
| `web/app/api/profile/route.ts` | Whitelister `hr_zone_method`, `hr_zones_custom`, `hr_method_updated_at` |
| `web/app/(main)/profile/page.tsx` | Wire les nouveaux composants, supprimer les anciens |

**Files à supprimer :**

- `web/components/settings/ProfileSourceSection.tsx`
- `web/components/settings/ProfileCardioSection.tsx`

---

## Phase 1 — Données et logique pure

### Task 1 — Migration Supabase 010

**Files:**
- Create: `web/supabase/migrations/010_hr_zone_method.sql`

- [ ] **Step 1 — Écrire la migration**

```sql
-- 010_hr_zone_method.sql
-- Ajoute le stockage de la méthode active de calcul des zones FC
-- et les zones personnalisées (méthode 'custom').

alter table profiles
  add column if not exists hr_zone_method        text,
  add column if not exists hr_zones_custom       jsonb,
  add column if not exists hr_method_updated_at  timestamptz;

-- Valeurs autorisées : 'seuils' | 'test30' | 'karvonen' | 'pct_max' | 'auto' | 'deduced' | 'custom'
-- hr_zones_custom uniquement si hr_zone_method = 'custom'
-- Format JSON : [{"zone":1,"min":null,"max":120},...,{"zone":5,"min":156,"max":190}]

alter table profiles
  add constraint hr_zone_method_check
  check (hr_zone_method is null or hr_zone_method in (
    'seuils','test30','karvonen','pct_max','auto','deduced','custom'
  ));
```

- [ ] **Step 2 — Commit**

```bash
git add web/supabase/migrations/010_hr_zone_method.sql
git commit -m "feat(db): add hr_zone_method columns to profiles (migration 010)"
```

- [ ] **Step 3 — Rappeler à Franck d'appliquer le SQL dans le dashboard Supabase**

> ⚠️ Cette migration **n'est PAS auto-appliquée**. Colle le contenu de `web/supabase/migrations/010_hr_zone_method.sql` dans **Supabase Dashboard → SQL Editor** et exécute, avant de tester le reste du plan.

---

### Task 2 — Métadonnées des méthodes

**Files:**
- Create: `web/lib/health/hr-method-meta.ts`
- Test: `web/__tests__/lib/health/hr-method-meta.test.ts`

- [ ] **Step 1 — Écrire les tests d'abord**

```ts
// web/__tests__/lib/health/hr-method-meta.test.ts
import { HR_METHODS, getMethodMeta, requiredFieldsFor } from '@/lib/health/hr-method-meta'

describe('HR_METHODS', () => {
  it('a 7 méthodes', () => {
    expect(HR_METHODS).toHaveLength(7)
  })

  it('chaque méthode a un libellé, une description, un badge et une couleur', () => {
    for (const m of HR_METHODS) {
      expect(m.label).toBeTruthy()
      expect(m.description).toBeTruthy()
      expect(m.badge).toBeTruthy()
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('getMethodMeta', () => {
  it('retourne la méta correcte', () => {
    expect(getMethodMeta('seuils').color).toBe('#22c55e')
    expect(getMethodMeta('karvonen').color).toBe('#facc15')
    expect(getMethodMeta('custom').badge).toBe('Custom')
  })
})

describe('requiredFieldsFor', () => {
  it('seuils → max_hr, aerobic_threshold_hr, threshold_hr', () => {
    expect(requiredFieldsFor('seuils')).toEqual(['max_hr', 'aerobic_threshold_hr', 'threshold_hr'])
  })

  it('test30 → max_hr, threshold_hr', () => {
    expect(requiredFieldsFor('test30')).toEqual(['max_hr', 'threshold_hr'])
  })

  it('karvonen → max_hr, resting_hr', () => {
    expect(requiredFieldsFor('karvonen')).toEqual(['max_hr', 'resting_hr'])
  })

  it('pct_max → max_hr seul', () => {
    expect(requiredFieldsFor('pct_max')).toEqual(['max_hr'])
  })

  it('auto → birth_year seul', () => {
    expect(requiredFieldsFor('auto')).toEqual(['birth_year'])
  })

  it('deduced → aucun champ requis', () => {
    expect(requiredFieldsFor('deduced')).toEqual([])
  })

  it('custom → hr_zones_custom', () => {
    expect(requiredFieldsFor('custom')).toEqual(['hr_zones_custom'])
  })
})
```

- [ ] **Step 2 — Lancer les tests pour vérifier qu'ils échouent**

```bash
cd web && npx jest hr-method-meta -t "HR_METHODS" --no-coverage
```

Expected: échec sur l'import (fichier inexistant).

- [ ] **Step 3 — Écrire l'implémentation**

```ts
// web/lib/health/hr-method-meta.ts
import type { HrZoneMethod } from './hr-zones'

export type HrMethodMeta = {
  value:       HrZoneMethod
  label:       string
  description: string
  badge:       string
  color:       string    // hex couleur de fiabilité
  badgeBg:     string    // background du badge (couleur + alpha)
}

export const HR_METHODS: HrMethodMeta[] = [
  {
    value: 'seuils',
    label: 'Seuils physiologiques',
    description: 'Le plus précis : seuils aérobie + anaérobie mesurés.',
    badge: 'Excellent',
    color: '#22c55e',
    badgeBg: '#16a34a33',
  },
  {
    value: 'test30',
    label: 'Test terrain 30 min',
    description: 'Test 30 min : FC moyenne des 20 dernières minutes = ta LTHR.',
    badge: 'Très bien',
    color: '#22c55e',
    badgeBg: '#16a34a33',
  },
  {
    value: 'karvonen',
    label: 'Réserve FC / Karvonen',
    description: 'Basé sur la FC max + FC repos. Plus pertinent qu\'un simple % de FC max.',
    badge: 'Bien',
    color: '#facc15',
    badgeBg: '#eab30833',
  },
  {
    value: 'pct_max',
    label: '% FC max',
    description: 'Simple : uniquement la FC max.',
    badge: 'Correct',
    color: '#fb923c',
    badgeBg: '#e8651a33',
  },
  {
    value: 'auto',
    label: 'Estimation automatique',
    description: 'FC max estimée par l\'âge (208 − 0.7 × âge).',
    badge: 'Approximatif',
    color: '#f87171',
    badgeBg: '#ef444433',
  },
  {
    value: 'deduced',
    label: 'Déduire automatiquement',
    description: 'L\'app analyse ton historique Strava pour déduire FC max observée, FC repos et seuils.',
    badge: 'Adaptatif',
    color: '#fb923c',
    badgeBg: '#e8651a33',
  },
  {
    value: 'custom',
    label: 'Personnalisé',
    description: 'Tu saisis tes 5 zones manuellement (Z1 à Z5).',
    badge: 'Custom',
    color: '#9ca3af',
    badgeBg: '#6b728033',
  },
]

export function getMethodMeta(method: HrZoneMethod): HrMethodMeta {
  return HR_METHODS.find(m => m.value === method) ?? HR_METHODS[0]
}

export type RequiredField =
  | 'max_hr' | 'aerobic_threshold_hr' | 'threshold_hr' | 'resting_hr'
  | 'birth_year' | 'hr_zones_custom'

export function requiredFieldsFor(method: HrZoneMethod): RequiredField[] {
  switch (method) {
    case 'seuils':   return ['max_hr', 'aerobic_threshold_hr', 'threshold_hr']
    case 'test30':   return ['max_hr', 'threshold_hr']
    case 'karvonen': return ['max_hr', 'resting_hr']
    case 'pct_max':  return ['max_hr']
    case 'auto':     return ['birth_year']
    case 'deduced':  return []
    case 'custom':   return ['hr_zones_custom']
  }
}
```

- [ ] **Step 4 — Lancer les tests, ils passent**

```bash
cd web && npx jest hr-method-meta --no-coverage
```

Expected: tous verts.

- [ ] **Step 5 — Commit**

```bash
git add web/lib/health/hr-method-meta.ts web/__tests__/lib/health/hr-method-meta.test.ts
git commit -m "feat(health): add HR method metadata (colors, labels, required fields)"
```

---

### Task 3 — Étendre `hr-zones.ts` avec méthode `deduced`

**Files:**
- Modify: `web/lib/health/hr-zones.ts`
- Modify: `web/__tests__/lib/health/hr-zones.test.ts`

- [ ] **Step 1 — Ajouter un test pour la méthode `deduced`**

```ts
// Append à web/__tests__/lib/health/hr-zones.test.ts
describe('méthode deduced', () => {
  it('utilise les valeurs déduites pour calculer les zones (Karvonen-like)', () => {
    const result = calculateHrZones({
      method: 'deduced',
      maxHr: 192,             // maxHrObserved
      restingHr: 54,          // restingHrEstimated
      thresholdHr: 176,       // lthrEstimated (ignoré ici, on prend Karvonen logic)
    })
    expect(result.zones.length).toBe(5)
    expect(result.confidence).toBe('Adaptative')
    expect(result.maxHrUsed).toBe(192)
  })

  it('signale les valeurs manquantes', () => {
    const result = calculateHrZones({ method: 'deduced' })
    expect(result.zones.length).toBe(0)
    expect(result.missing).toContain('FC max observée')
  })
})
```

- [ ] **Step 2 — Lancer le test, il échoue**

```bash
cd web && npx jest hr-zones -t "méthode deduced" --no-coverage
```

Expected: échec — le type ne contient pas `'deduced'`.

- [ ] **Step 3 — Étendre le type et le switch**

Modifier `web/lib/health/hr-zones.ts` :

```ts
// Remplacer la ligne 1 :
export type HrZoneMethod = 'seuils' | 'test30' | 'karvonen' | 'pct_max' | 'auto' | 'deduced' | 'custom'
```

Modifier le type `HrZoneResult` ligne 14 :

```ts
confidence: 'Excellente' | 'Très bien' | 'Bien' | 'Correcte' | 'Approximative' | 'Adaptative' | 'Personnalisée' | null
```

Ajouter le case dans le switch (avant `default`) ligne ~109 :

```ts
case 'deduced': {
  const max  = need(maxHr, 'FC max observée')
  const rest = need(restingHr, 'FC repos estimée')
  if (!max || !rest) return { zones: [], method, confidence: 'Adaptative', maxHrUsed: max ?? null, missing }
  const reserve = max - rest
  const maxes = [0.60, 0.70, 0.80, 0.90].map(p => Math.round(rest + p * reserve)).concat([max])
  return { zones: makeZones(pctRanges(maxes)), method, confidence: 'Adaptative', maxHrUsed: max, missing }
}
```

- [ ] **Step 4 — Lancer le test, il passe**

```bash
cd web && npx jest hr-zones --no-coverage
```

- [ ] **Step 5 — Commit**

```bash
git add web/lib/health/hr-zones.ts web/__tests__/lib/health/hr-zones.test.ts
git commit -m "feat(health): add 'deduced' HR zone calculation method"
```

---

### Task 4 — Logique de déduction depuis Supabase

**Files:**
- Create: `web/lib/health/hr-deduce.ts`
- Test: `web/__tests__/lib/health/hr-deduce.test.ts`

- [ ] **Step 1 — Écrire les tests**

```ts
// web/__tests__/lib/health/hr-deduce.test.ts
import { deduceFromActivities } from '@/lib/health/hr-deduce'

const mkAct = (max_hr: number | null, moving_time_sec = 1800) => ({ max_hr, moving_time_sec })

describe('deduceFromActivities', () => {
  it('retourne null sur tous les champs si pas d\'activités', () => {
    const result = deduceFromActivities([], null)
    expect(result.maxHrObserved).toBeNull()
    expect(result.restingHrEstimated).toBeNull()
    expect(result.lthrEstimated).toBeNull()
  })

  it('calcule maxHrObserved comme max global', () => {
    const result = deduceFromActivities([mkAct(180), mkAct(192), mkAct(175)], null)
    expect(result.maxHrObserved).toBe(192)
  })

  it('ignore les max_hr null', () => {
    const result = deduceFromActivities([mkAct(null), mkAct(185)], null)
    expect(result.maxHrObserved).toBe(185)
  })

  it('utilise restingHr depuis athlete_data si présent', () => {
    const result = deduceFromActivities([mkAct(180)], { resting_heart_rate: 52 })
    expect(result.restingHrEstimated).toBe(52)
  })

  it('retourne null pour restingHr si athlete_data ne le contient pas', () => {
    const result = deduceFromActivities([mkAct(180)], {})
    expect(result.restingHrEstimated).toBeNull()
  })

  it('calcule lthrEstimated comme p90 des max_hr sur runs >= 30min', () => {
    const acts = Array.from({ length: 10 }, (_, i) => mkAct(170 + i, 1800))
    // max_hr = [170,171,...,179], p90 ≈ 179
    const result = deduceFromActivities(acts, null)
    expect(result.lthrEstimated).toBe(179)
  })

  it('ignore les activités < 30min pour lthrEstimated', () => {
    const acts = [mkAct(200, 600), mkAct(170, 2000)]
    // Seul le 2e est inclus
    const result = deduceFromActivities(acts, null)
    expect(result.lthrEstimated).toBe(170)
  })

  it('inclut un timestamp computedAt', () => {
    const result = deduceFromActivities([mkAct(180)], null)
    expect(result.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
```

- [ ] **Step 2 — Lancer les tests, ils échouent**

```bash
cd web && npx jest hr-deduce --no-coverage
```

- [ ] **Step 3 — Écrire l'implémentation**

```ts
// web/lib/health/hr-deduce.ts

export type DeducedHrValues = {
  maxHrObserved:      number | null
  restingHrEstimated: number | null
  lthrEstimated:      number | null
  computedAt:         string
}

export type ActivityForDeduce = {
  max_hr:          number | null
  moving_time_sec: number
}

export type StravaAthleteData = {
  resting_heart_rate?: number | null
} | null

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))
  return sorted[idx]
}

export function deduceFromActivities(
  activities: ActivityForDeduce[],
  athleteData: StravaAthleteData,
): DeducedHrValues {
  const maxHrs = activities
    .map(a => a.max_hr)
    .filter((v): v is number => v != null && v > 0)

  const maxHrObserved = maxHrs.length > 0 ? Math.max(...maxHrs) : null

  const restingHrEstimated = athleteData?.resting_heart_rate ?? null

  const longRunsMaxHr = activities
    .filter(a => a.moving_time_sec >= 1800 && a.max_hr != null && a.max_hr > 0)
    .map(a => a.max_hr as number)
    .sort((a, b) => a - b)

  const lthrEstimated = percentile(longRunsMaxHr, 0.90)

  return {
    maxHrObserved,
    restingHrEstimated,
    lthrEstimated,
    computedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 4 — Lancer les tests, ils passent**

```bash
cd web && npx jest hr-deduce --no-coverage
```

- [ ] **Step 5 — Commit**

```bash
git add web/lib/health/hr-deduce.ts web/__tests__/lib/health/hr-deduce.test.ts
git commit -m "feat(health): add deduceFromActivities for auto HR values"
```

---

## Phase 2 — Sous-composants UI

### Task 5 — `TestProtocolModal`

**Files:**
- Create: `web/components/settings/TestProtocolModal.tsx`

- [ ] **Step 1 — Écrire le composant**

```tsx
// web/components/settings/TestProtocolModal.tsx
'use client'

import { useEffect } from 'react'
import { colors } from '@/lib/design/colors'

export function TestProtocolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-[12px] p-[14px] max-w-md w-full max-h-[90vh] overflow-y-auto space-y-[10px]"
        style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[14px] font-bold text-trail-text">Protocole — Test terrain 30 min</p>
            <p className="text-[11px] text-trail-muted">Méthode Coggan / Friel — détermine ta LTHR</p>
          </div>
          <button onClick={onClose} className="text-trail-muted text-[20px] leading-none" aria-label="Fermer">×</button>
        </div>

        <section>
          <p className="text-[12px] font-semibold" style={{ color: '#22c55e' }}>✓ À faire avant</p>
          <ul className="text-[12px] text-trail-text pl-5 mt-1 list-disc space-y-[2px]">
            <li>Repos complet 24h, hydratation, pas d&apos;alcool la veille</li>
            <li>Choisir un parcours plat ou piste, par temps tempéré</li>
            <li>Échauffement 15 min progressif (Z1 → Z3)</li>
          </ul>
        </section>

        <section>
          <p className="text-[12px] font-semibold" style={{ color: '#fb923c' }}>⏱ Pendant le test</p>
          <ul className="text-[12px] text-trail-text pl-5 mt-1 list-disc space-y-[2px]">
            <li>Cours <strong>30 minutes en continu à allure maximale soutenable</strong></li>
            <li>Démarre à un rythme que tu sais tenir 30 min — pas un sprint</li>
            <li>Démarre le lap <strong>après 10 min</strong> de test (clé du protocole)</li>
            <li>Garde un effort très régulier sur les 20 dernières minutes</li>
          </ul>
        </section>

        <section>
          <p className="text-[12px] font-semibold" style={{ color: '#facc15' }}>📊 Lecture du résultat</p>
          <div className="rounded-[8px] p-[8px] mt-1" style={{ backgroundColor: colors.surface }}>
            <p className="text-[13px] font-bold text-trail-text">FC moyenne des 20 dernières minutes = ta LTHR</p>
            <p className="text-[11px] text-trail-muted mt-1">C&apos;est cette valeur que tu reportes dans « FC seuil test 30 min ».</p>
          </div>
        </section>

        <div className="rounded-[6px] p-[8px] text-[11px]" style={{ backgroundColor: '#1f2419', border: '1px solid #facc15', color: '#facc15' }}>
          💡 À refaire tous les 3–6 mois ou après un bloc d&apos;entraînement structurant. La LTHR évolue avec ta forme.
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-[8px] py-[10px] text-[13px] font-bold text-white"
          style={{ backgroundColor: colors.chargeOrange }}
        >
          J&apos;ai compris, fermer
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 — Vérifier la compilation TypeScript**

```bash
cd web && npx tsc --noEmit
```

Expected: pas d'erreur sur ce fichier.

- [ ] **Step 3 — Commit**

```bash
git add web/components/settings/TestProtocolModal.tsx
git commit -m "feat(profile): add TestProtocolModal for 30-min field test"
```

---

### Task 6 — `RestingHrInfoPopover`

**Files:**
- Create: `web/components/settings/RestingHrInfoPopover.tsx`

- [ ] **Step 1 — Écrire le composant**

```tsx
// web/components/settings/RestingHrInfoPopover.tsx
'use client'

import { useEffect, useRef } from 'react'
import { colors } from '@/lib/design/colors'

export function RestingHrInfoPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute z-40 mt-2 rounded-[10px] p-[12px] w-[300px] text-[11px] space-y-[8px]"
      style={{ backgroundColor: colors.card, border: `1px solid ${colors.chargeOrange}`, color: colors.text }}
    >
      <p className="text-[13px] font-bold">Comment mesurer ta FC repos ?</p>

      <div>
        <p className="font-semibold" style={{ color: '#22c55e' }}>🛏 Méthode manuelle</p>
        <p className="text-trail-text mt-1">
          Le matin, juste après le réveil, <strong>avant de te lever</strong>. Compte tes pulsations 60 secondes (poignet ou carotide). Refais sur 3 matins, garde la moyenne.
        </p>
      </div>

      <div>
        <p className="font-semibold" style={{ color: '#22c55e' }}>⌚ Sur ta montre / appli</p>
        <ul className="list-disc pl-5 mt-1 space-y-[2px] text-trail-text">
          <li><strong>Garmin Connect</strong> — Plus ... (en bas à droite) → Statistiques de santé → Fréquence cardiaque → 7j (en bas à gauche)</li>
          <li><strong>Apple Watch</strong> — Santé → Cœur → Fréquence cardiaque au repos</li>
          <li><strong>Coros</strong> — App → Santé → FC au repos (mesure nocturne)</li>
          <li><strong>Polar / Suunto / Fitbit</strong> — section « Repos / RHR » de l&apos;app</li>
        </ul>
      </div>

      <div className="rounded-[6px] p-[6px] text-[10px]" style={{ backgroundColor: colors.surface, border: '1px solid #facc15', color: '#facc15' }}>
        💡 La FC repos varie. Note plutôt la <strong>moyenne sur 7–14 jours</strong>, hors période de fatigue / malade.
      </div>
    </div>
  )
}
```

- [ ] **Step 2 — Commit**

```bash
git add web/components/settings/RestingHrInfoPopover.tsx
git commit -m "feat(profile): add RestingHrInfoPopover with measurement tips"
```

---

### Task 7 — `CustomZonesEditor` avec validation

**Files:**
- Create: `web/components/settings/CustomZonesEditor.tsx`
- Test: `web/__tests__/components/CustomZonesEditor.test.tsx`

- [ ] **Step 1 — Test logique de validation (fonction pure exportée)**

```ts
// web/__tests__/components/CustomZonesEditor.test.tsx
import { validateCustomZones, type CustomZone } from '@/components/settings/CustomZonesEditor'

const zones = (rows: [number | null, number | null][]): CustomZone[] =>
  rows.map((r, i) => ({ zone: i + 1, min: r[0], max: r[1] }))

describe('validateCustomZones', () => {
  it('passe avec 5 zones continues et croissantes', () => {
    const errs = validateCustomZones(zones([[null, 120], [121, 130], [131, 142], [143, 154], [155, 167]]))
    expect(errs).toEqual([])
  })

  it('détecte un chevauchement', () => {
    const errs = validateCustomZones(zones([[null, 120], [115, 130], [131, 142], [143, 154], [155, 167]]))
    expect(errs[0]).toMatch(/Z2/)
  })

  it('détecte un trou entre zones', () => {
    const errs = validateCustomZones(zones([[null, 120], [125, 130], [131, 142], [143, 154], [155, 167]]))
    expect(errs[0]).toMatch(/Z2/)
  })

  it('détecte min > max sur une zone', () => {
    const errs = validateCustomZones(zones([[null, 120], [121, 130], [142, 131], [143, 154], [155, 167]]))
    expect(errs[0]).toMatch(/Z3/)
  })

  it('détecte une valeur manquante', () => {
    const errs = validateCustomZones(zones([[null, 120], [121, null], [131, 142], [143, 154], [155, 167]]))
    expect(errs[0]).toMatch(/Z2/)
  })
})
```

- [ ] **Step 2 — Lancer le test, il échoue**

```bash
cd web && npx jest CustomZonesEditor --no-coverage
```

- [ ] **Step 3 — Écrire le composant + la fonction de validation**

```tsx
// web/components/settings/CustomZonesEditor.tsx
'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'

export type CustomZone = { zone: number; min: number | null; max: number | null }

export function validateCustomZones(zones: CustomZone[]): string[] {
  const errors: string[] = []
  if (zones.length !== 5) errors.push('Il faut exactement 5 zones.')

  for (const z of zones) {
    if (z.zone === 1) {
      if (z.max == null) errors.push(`Z${z.zone} : valeur max manquante`)
    } else {
      if (z.min == null || z.max == null) errors.push(`Z${z.zone} : valeur manquante`)
      else if (z.min > z.max) errors.push(`Z${z.zone} : min > max`)
    }
  }

  for (let i = 1; i < zones.length; i++) {
    const prev = zones[i - 1]
    const cur  = zones[i]
    if (prev.max == null || cur.min == null) continue
    if (cur.min !== prev.max + 1) {
      errors.push(`Z${cur.zone} doit commencer à ${prev.max + 1} (continuité avec Z${prev.zone})`)
    }
  }

  return errors
}

const DEFAULT_ZONES: CustomZone[] = [
  { zone: 1, min: null, max: 120 },
  { zone: 2, min: 121,  max: 130 },
  { zone: 3, min: 131,  max: 142 },
  { zone: 4, min: 143,  max: 154 },
  { zone: 5, min: 155,  max: 167 },
]

export function CustomZonesEditor({
  initial, onChange,
}: {
  initial: CustomZone[] | null
  onChange: (zones: CustomZone[], errors: string[]) => void
}) {
  const [zones, setZones] = useState<CustomZone[]>(initial && initial.length === 5 ? initial : DEFAULT_ZONES)

  function update(idx: number, field: 'min' | 'max', value: string) {
    const v = value === '' ? null : parseInt(value, 10)
    const next = zones.map((z, i) => i === idx ? { ...z, [field]: Number.isFinite(v) ? v : null } : z)
    setZones(next)
    onChange(next, validateCustomZones(next))
  }

  const errors = validateCustomZones(zones)

  return (
    <div className="space-y-[6px]">
      {zones.map((z, i) => (
        <div key={z.zone} className="flex items-center gap-[8px]">
          <span className="text-[12px] font-bold text-trail-text w-[24px]">Z{z.zone}</span>
          <div className="flex-1 rounded-[8px] px-[10px] py-[6px]" style={{ backgroundColor: colors.surface }}>
            <p className="text-[10px] text-trail-muted">Min</p>
            <input
              type="number" inputMode="numeric"
              value={z.min ?? ''}
              disabled={z.zone === 1}
              placeholder={z.zone === 1 ? '—' : ''}
              onChange={e => update(i, 'min', e.target.value)}
              className="bg-transparent text-[14px] font-semibold outline-none w-full text-trail-text"
            />
          </div>
          <div className="flex-1 rounded-[8px] px-[10px] py-[6px]" style={{ backgroundColor: colors.surface }}>
            <p className="text-[10px] text-trail-muted">Max</p>
            <input
              type="number" inputMode="numeric"
              value={z.max ?? ''}
              onChange={e => update(i, 'max', e.target.value)}
              className="bg-transparent text-[14px] font-semibold outline-none w-full text-trail-text"
            />
          </div>
        </div>
      ))}
      {errors.length > 0 && (
        <ul className="text-[11px] mt-2" style={{ color: '#f87171' }}>
          {errors.map((e, i) => <li key={i}>• {e}</li>)}
        </ul>
      )}
      <p className="text-[11px] text-trail-muted leading-[16px]">
        Vérifie que les zones personnalisées sont continues, croissantes et sans chevauchement.
      </p>
    </div>
  )
}
```

- [ ] **Step 4 — Tests passent**

```bash
cd web && npx jest CustomZonesEditor --no-coverage
```

- [ ] **Step 5 — Commit**

```bash
git add web/components/settings/CustomZonesEditor.tsx web/__tests__/components/CustomZonesEditor.test.tsx
git commit -m "feat(profile): add CustomZonesEditor with live validation"
```

---

## Phase 3 — Composants composites

### Task 8 — Étendre `HrZoneMethod` (7 méthodes, badges colorés)

**Files:**
- Modify: `web/components/settings/HrZoneMethod.tsx`

- [ ] **Step 1 — Réécrire le composant**

Remplacer entièrement le contenu de `web/components/settings/HrZoneMethod.tsx` :

```tsx
'use client'

import { useEffect } from 'react'
import { colors } from '@/lib/design/colors'
import { HR_METHODS } from '@/lib/health/hr-method-meta'
import type { HrZoneMethod as Method } from '@/lib/health/hr-zones'

const STORAGE_KEY = 'tc_hr_zone_method'

export function HrZoneMethod({ value, onChange }: { value: Method; onChange: (m: Method) => void }) {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && HR_METHODS.find(m => m.value === saved)) {
      if (saved !== value) onChange(saved as Method)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function select(m: Method) {
    onChange(m)
    localStorage.setItem(STORAGE_KEY, m)
  }

  return (
    <div className="space-y-2">
      {HR_METHODS.map(m => {
        const active = value === m.value
        return (
          <button
            key={m.value}
            onClick={() => select(m.value)}
            className="w-full text-left rounded-[10px] border px-[12px] py-[10px] transition-colors"
            style={{
              borderColor:     active ? m.color : colors.border,
              backgroundColor: active ? `${m.color}1A` : colors.surface,
              cursor: 'pointer',
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex-shrink-0 rounded-full border-2 flex items-center justify-center"
                style={{ width: 18, height: 18, borderColor: active ? m.color : colors.border }}
              >
                {active && <div className="rounded-full" style={{ width: 9, height: 9, backgroundColor: m.color }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-semibold text-trail-text">{m.label}</span>
                  <span className="text-[11px] font-bold px-[6px] py-[1px] rounded-full"
                    style={{ backgroundColor: m.badgeBg, color: m.color }}>
                    {m.badge}
                  </span>
                </div>
                <p className="text-[12px] text-trail-muted mt-[2px] leading-[16px]">{m.description}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2 — Vérifier la compilation**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3 — Commit**

```bash
git add web/components/settings/HrZoneMethod.tsx
git commit -m "feat(profile): extend HrZoneMethod to 7 methods with confidence-colored badges"
```

---

### Task 9 — `HrCardioFields` (affichage conditionnel)

**Files:**
- Create: `web/components/settings/HrCardioFields.tsx`

- [ ] **Step 1 — Écrire le composant**

```tsx
// web/components/settings/HrCardioFields.tsx
'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'
import type { HrZoneMethod as Method } from '@/lib/health/hr-zones'
import { TestProtocolModal } from './TestProtocolModal'
import { RestingHrInfoPopover } from './RestingHrInfoPopover'
import { CustomZonesEditor, type CustomZone } from './CustomZonesEditor'

export type CardioState = {
  max_hr:               number | null
  resting_hr:           number | null
  aerobic_threshold_hr: number | null
  threshold_hr:         number | null
  birth_year:           number | null
  hr_zones_custom:      CustomZone[] | null
}

export type DeducedValues = {
  maxHrObserved:      number | null
  restingHrEstimated: number | null
  lthrEstimated:      number | null
  computedAt:         string | null
}

function Field({ label, value, onChange, unit, disabled, info, alert }: {
  label: string
  value: number | null
  onChange?: (v: number | null) => void
  unit?: string
  disabled?: boolean
  info?: React.ReactNode
  alert?: boolean
}) {
  return (
    <div
      className="rounded-[10px] px-[12px] py-[8px]"
      style={{
        backgroundColor: colors.surface,
        border: alert ? '1px dashed #fb923c' : 'none',
      }}
    >
      <p className="text-[11px] text-trail-muted mb-[4px] flex items-center gap-[4px]">
        {label}{info}
      </p>
      <div className="flex items-center gap-[6px]">
        <input
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          disabled={disabled}
          onChange={e => {
            const v = e.target.value === '' ? null : parseInt(e.target.value, 10)
            onChange?.(Number.isFinite(v) ? v : null)
          }}
          className="flex-1 bg-transparent text-[15px] font-semibold outline-none"
          style={{ color: value ? colors.text : colors.subtleText, minWidth: 0 }}
        />
        {unit && <span className="text-[12px] text-trail-muted flex-shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

export function HrCardioFields({
  method, state, onChange, deduced, onRecompute,
}: {
  method:      Method
  state:       CardioState
  onChange:    (next: CardioState) => void
  deduced:     DeducedValues
  onRecompute: () => void
}) {
  const [protocolOpen, setProtocolOpen]   = useState(false)
  const [restingInfoOpen, setRestingInfo] = useState(false)

  const set = <K extends keyof CardioState>(key: K, v: CardioState[K]) => onChange({ ...state, [key]: v })

  const estimatedMaxFromAge = state.birth_year
    ? Math.round(208 - 0.7 * (new Date().getFullYear() - state.birth_year))
    : null

  return (
    <div className="space-y-[8px]">
      {method === 'seuils' && <>
        <Field label="FC max" unit="bpm" value={state.max_hr} onChange={v => set('max_hr', v)} />
        <div className="grid grid-cols-2 gap-[8px]">
          <Field label="Seuil aérobie / AeT" unit="bpm" value={state.aerobic_threshold_hr} onChange={v => set('aerobic_threshold_hr', v)} />
          <Field label="Seuil anaéro / LTHR" unit="bpm" value={state.threshold_hr} onChange={v => set('threshold_hr', v)} />
        </div>
      </>}

      {method === 'test30' && <>
        <Field label="FC max" unit="bpm" value={state.max_hr} onChange={v => set('max_hr', v)} />
        <Field label="FC seuil test 30 min" unit="bpm" value={state.threshold_hr} onChange={v => set('threshold_hr', v)} />
        <button
          onClick={() => setProtocolOpen(true)}
          className="rounded-[8px] px-[10px] py-[6px] text-[12px] font-semibold border"
          style={{ borderColor: colors.border, color: colors.text }}
        >
          📖 Voir le protocole du test
        </button>
        <TestProtocolModal open={protocolOpen} onClose={() => setProtocolOpen(false)} />
      </>}

      {method === 'karvonen' && <>
        <Field label="FC max" unit="bpm" value={state.max_hr} onChange={v => set('max_hr', v)} />
        <div className="relative">
          <Field
            label="FC repos"
            unit="bpm"
            value={state.resting_hr}
            onChange={v => set('resting_hr', v)}
            info={
              <button
                type="button"
                onClick={() => setRestingInfo(v => !v)}
                className="inline-flex items-center justify-center rounded-full border text-[9px] italic"
                style={{ width: 14, height: 14, borderColor: '#fb923c', color: '#fb923c' }}
                aria-label="Comment mesurer la FC repos"
              >i</button>
            }
          />
          <RestingHrInfoPopover open={restingInfoOpen} onClose={() => setRestingInfo(false)} />
        </div>
      </>}

      {method === 'pct_max' && (
        <Field label="FC max" unit="bpm" value={state.max_hr} onChange={v => set('max_hr', v)} />
      )}

      {method === 'auto' && <>
        <Field label="FC max estimée (calculée)" unit="bpm" value={estimatedMaxFromAge} disabled />
        <Field
          label="Année de naissance (requis)"
          value={state.birth_year}
          onChange={v => set('birth_year', v)}
          alert={!state.birth_year}
        />
      </>}

      {method === 'deduced' && (
        <div className="rounded-[10px] p-[12px] text-[12px]" style={{ backgroundColor: colors.surface }}>
          <p className="text-trail-muted mb-2">Détecté depuis Strava :</p>
          <ul className="space-y-1 text-trail-text">
            <li>• FC max observée : <strong>{deduced.maxHrObserved ?? '—'} bpm</strong></li>
            <li>• FC repos estimée : <strong>{deduced.restingHrEstimated ?? '—'} bpm</strong></li>
            <li>• LTHR estimée : <strong>{deduced.lthrEstimated ?? '—'} bpm</strong></li>
          </ul>
          <button
            onClick={onRecompute}
            className="mt-3 rounded-[8px] px-[10px] py-[6px] text-[12px] font-semibold border"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            🔄 Recalculer depuis l&apos;historique
          </button>
          {deduced.maxHrObserved == null && (
            <p className="text-[11px] text-trail-muted mt-2">
              Aucune activité avec FC trouvée. Importe des activités Strava pour activer ce mode.
            </p>
          )}
        </div>
      )}

      {method === 'custom' && (
        <CustomZonesEditor
          initial={state.hr_zones_custom}
          onChange={(zones, errors) => {
            set('hr_zones_custom', errors.length === 0 ? zones : zones)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2 — Compile check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3 — Commit**

```bash
git add web/components/settings/HrCardioFields.tsx
git commit -m "feat(profile): add HrCardioFields with conditional rendering per method"
```

---

### Task 10 — `HrCalibrationCard` (wrapper avec save)

**Files:**
- Create: `web/components/settings/HrCalibrationCard.tsx`

- [ ] **Step 1 — Écrire le composant**

```tsx
// web/components/settings/HrCalibrationCard.tsx
'use client'

import { useEffect, useState } from 'react'
import { colors } from '@/lib/design/colors'
import type { HrZoneMethod as Method } from '@/lib/health/hr-zones'
import { requiredFieldsFor } from '@/lib/health/hr-method-meta'
import { HrZoneMethod } from './HrZoneMethod'
import { HrCardioFields, type CardioState, type DeducedValues } from './HrCardioFields'
import { deduceFromActivities, type ActivityForDeduce, type StravaAthleteData } from '@/lib/health/hr-deduce'

type Status = 'idle' | 'saving' | 'saved' | 'error'

const DEDUCED_KEY = 'tc_hr_deduced'

export function HrCalibrationCard({
  initial, initialMethod, athleteData,
}: {
  initial:       CardioState
  initialMethod: Method
  athleteData:   StravaAthleteData
}) {
  const [method, setMethod] = useState<Method>(initialMethod)
  const [state,  setState]  = useState<CardioState>(initial)
  const [status, setStatus] = useState<Status>('idle')
  const [deduced, setDeduced] = useState<DeducedValues>({
    maxHrObserved: null, restingHrEstimated: null, lthrEstimated: null, computedAt: null,
  })

  useEffect(() => {
    try {
      const cached = localStorage.getItem(DEDUCED_KEY)
      if (cached) setDeduced(JSON.parse(cached))
    } catch {}
  }, [])

  async function recomputeDeduced() {
    const res = await fetch('/api/activities/list-for-deduce')
    if (!res.ok) return
    const acts: ActivityForDeduce[] = await res.json()
    const next = deduceFromActivities(acts, athleteData)
    setDeduced(next)
    try { localStorage.setItem(DEDUCED_KEY, JSON.stringify(next)) } catch {}
  }

  useEffect(() => {
    if (method === 'deduced' && deduced.computedAt == null) {
      recomputeDeduced()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method])

  async function save() {
    const required = requiredFieldsFor(method)
    const missing = required.filter(f => {
      if (f === 'hr_zones_custom') return !state.hr_zones_custom || state.hr_zones_custom.length !== 5
      return state[f] == null
    })
    if (missing.length > 0) {
      setStatus('error')
      return
    }

    setStatus('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_hr:               state.max_hr,
          aerobic_threshold_hr: state.aerobic_threshold_hr,
          threshold_hr:         state.threshold_hr,
          resting_hr:           state.resting_hr,
          birth_year:           state.birth_year,
          hr_zone_method:       method,
          hr_zones_custom:      method === 'custom' ? state.hr_zones_custom : null,
          hr_method_updated_at: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        try {
          localStorage.setItem('tc_athlete_hr', JSON.stringify({
            maxHr:              state.max_hr,
            restingHr:          state.resting_hr,
            aerobicThresholdHr: state.aerobic_threshold_hr,
            thresholdHr:        state.threshold_hr,
            birthYear:          state.birth_year,
          }))
          if (state.hr_zones_custom) {
            localStorage.setItem('tc_hr_zones_custom', JSON.stringify(state.hr_zones_custom))
          }
        } catch {}
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 2500)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="space-y-[10px]">
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[10px]">
        <p className="text-[14px] font-bold text-trail-text">Méthode de calcul des zones</p>
        <HrZoneMethod value={method} onChange={setMethod} />
      </div>

      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[8px]">
        <p className="text-[14px] font-bold text-trail-text">Données cardio</p>
        <HrCardioFields
          method={method}
          state={state}
          onChange={setState}
          deduced={deduced}
          onRecompute={recomputeDeduced}
        />
      </div>

      <button
        onClick={save}
        disabled={status === 'saving'}
        className="w-full rounded-[12px] py-[11px] text-[14px] font-bold text-white"
        style={{
          backgroundColor: status === 'error' ? '#ef4444'
            : status === 'saved' ? '#4caf50'
            : colors.chargeOrange,
          opacity: status === 'saving' ? 0.6 : 1,
          cursor:  status === 'saving' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'saving' ? 'Enregistrement…'
          : status === 'saved' ? '✓ Enregistré'
          : status === 'error' ? 'Erreur — champs requis manquants ou échec'
          : 'Enregistrer le profil'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2 — Compile check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3 — Commit**

```bash
git add web/components/settings/HrCalibrationCard.tsx
git commit -m "feat(profile): add HrCalibrationCard wrapper combining method + fields + save"
```

---

### Task 11 — Route API `/api/activities/list-for-deduce`

**Files:**
- Create: `web/app/api/activities/list-for-deduce/route.ts`

- [ ] **Step 1 — Écrire la route**

```ts
// web/app/api/activities/list-for-deduce/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('activities')
    .select('max_hr, moving_time_sec')
    .eq('user_id', user.id)
    .gte('start_date', oneYearAgo)
    .not('max_hr', 'is', null)
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
```

- [ ] **Step 2 — Compile check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3 — Commit**

```bash
git add web/app/api/activities/list-for-deduce/route.ts
git commit -m "feat(api): add list-for-deduce endpoint for HR auto-derivation"
```

---

### Task 12 — `HrSourcesPanel` (lecture seule)

**Files:**
- Create: `web/components/settings/HrSourcesPanel.tsx`

- [ ] **Step 1 — Écrire le composant**

```tsx
// web/components/settings/HrSourcesPanel.tsx
'use client'

import { colors } from '@/lib/design/colors'
import { getMethodMeta } from '@/lib/health/hr-method-meta'
import type { HrZoneMethod as Method } from '@/lib/health/hr-zones'
import { requiredFieldsFor } from '@/lib/health/hr-method-meta'
import type { DeducedValues } from './HrCardioFields'

type Row = {
  label:  string
  value:  number | null
  source: { tag: string; color: string }
  date:   string | null
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000))
  if (days < 1) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 30) return `il y a ${days}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function HrSourcesPanel({
  method, profile, deduced, methodUpdatedAt,
}: {
  method:           Method
  profile: {
    max_hr:               number | null
    resting_hr:           number | null
    threshold_hr:         number | null
    aerobic_threshold_hr: number | null
    birth_year:           number | null
  }
  deduced:          DeducedValues
  methodUpdatedAt:  string | null
}) {
  const meta = getMethodMeta(method)
  const required = requiredFieldsFor(method)

  const estimatedAge = profile.birth_year
    ? Math.round(208 - 0.7 * (new Date().getFullYear() - profile.birth_year))
    : null

  const rows: Array<Row & { activeKey: string }> = [
    { activeKey: 'max_hr',               label: 'FC max',           value: profile.max_hr,           source: { tag: '✓ Saisie',    color: '#22c55e' }, date: methodUpdatedAt },
    { activeKey: 'resting_hr',           label: 'FC repos',         value: profile.resting_hr,       source: { tag: '✓ Saisie',    color: '#22c55e' }, date: methodUpdatedAt },
    { activeKey: 'aerobic_threshold_hr', label: 'AeT (aérobie)',    value: profile.aerobic_threshold_hr, source: { tag: '✓ Saisie', color: '#22c55e' }, date: methodUpdatedAt },
    { activeKey: 'threshold_hr',         label: 'LTHR (anaéro)',    value: profile.threshold_hr,     source: { tag: '✓ Saisie',    color: '#22c55e' }, date: methodUpdatedAt },
    { activeKey: 'deduced_max',          label: 'FC max observée',  value: deduced.maxHrObserved,    source: { tag: '📡 Strava',   color: '#fb923c' }, date: deduced.computedAt },
    { activeKey: 'deduced_rest',         label: 'FC repos estimée', value: deduced.restingHrEstimated, source: { tag: '📡 Strava', color: '#fb923c' }, date: deduced.computedAt },
    { activeKey: 'deduced_lthr',         label: 'LTHR estimée',     value: deduced.lthrEstimated,    source: { tag: '∫ Calculée',  color: '#facc15' }, date: deduced.computedAt },
    { activeKey: 'estimated_max',        label: 'FC max estimée',   value: estimatedAge,             source: { tag: '📅 Âge',      color: '#9ca3af' }, date: null },
  ]

  const allEmpty = rows.every(r => r.value == null)
  if (allEmpty) return null

  function isActive(key: string): boolean {
    if (method === 'deduced') return ['deduced_max', 'deduced_rest', 'deduced_lthr'].includes(key)
    if (method === 'auto')    return key === 'estimated_max' || key === 'max_hr'
    return required.includes(key as ReturnType<typeof requiredFieldsFor>[number])
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[10px]">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold text-trail-text">Sources des valeurs</p>
        <span
          className="text-[10px] font-bold px-[8px] py-[2px] rounded-full"
          style={{ backgroundColor: meta.badgeBg, color: meta.color }}
        >
          {meta.label}
        </span>
      </div>

      <table className="w-full text-[12px]">
        <thead>
          <tr style={{ color: colors.subtleText }}>
            <th className="text-left font-medium py-[4px] text-[10px] uppercase">Valeur</th>
            <th className="text-right font-medium py-[4px] text-[10px] uppercase">Utilisée</th>
            <th className="text-right font-medium py-[4px] text-[10px] uppercase">Source</th>
            <th className="text-right font-medium py-[4px] text-[10px] uppercase">Maj</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const active = isActive(r.activeKey)
            return (
              <tr key={r.activeKey} style={{ borderTop: `1px solid ${colors.border}` }}>
                <td className="py-[6px]" style={{ color: colors.text }}>{r.label}</td>
                <td className="py-[6px] text-right font-semibold" style={{ color: active ? colors.text : colors.subtleText }}>
                  {r.value != null ? `${r.value} bpm` : '—'}
                </td>
                <td className="py-[6px] text-right text-[11px]" style={{ color: r.source.color }}>{r.source.tag}</td>
                <td className="py-[6px] text-right text-[11px]" style={{ color: colors.subtleText }}>{formatRelative(r.date)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="text-[11px] text-trail-muted leading-[16px] pl-2" style={{ borderLeft: '3px solid #22c55e' }}>
        Les valeurs <strong className="text-trail-text">en blanc</strong> sont utilisées par la méthode active. Les autres sont calculées en parallèle, dispo si tu changes de méthode.
      </p>
    </div>
  )
}
```

- [ ] **Step 2 — Compile check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3 — Commit**

```bash
git add web/components/settings/HrSourcesPanel.tsx
git commit -m "feat(profile): add HrSourcesPanel showing value provenance"
```

---

## Phase 4 — Intégration & nettoyage

### Task 13 — Étendre l'API `/api/profile`

**Files:**
- Modify: `web/app/api/profile/route.ts`

- [ ] **Step 1 — Ajouter les nouveaux champs à la whitelist**

Modifier `web/app/api/profile/route.ts` ligne 10 :

```ts
const allowed = [
  'first_name', 'last_name',
  'max_hr', 'threshold_hr', 'resting_hr', 'aerobic_threshold_hr',
  'ftp_watts', 'weight_kg', 'year_goal_km', 'birth_year',
  'threshold_pace_run_sec_per_km', 'threshold_pace_trail_sec_per_km',
  'hr_zone_method', 'hr_zones_custom', 'hr_method_updated_at',
]
```

- [ ] **Step 2 — Compile check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3 — Commit**

```bash
git add web/app/api/profile/route.ts
git commit -m "feat(api): whitelist hr_zone_method, hr_zones_custom, hr_method_updated_at on PATCH /api/profile"
```

---

### Task 14 — Wire la page profil + suppressions

**Files:**
- Modify: `web/app/(main)/profile/page.tsx`
- Delete: `web/components/settings/ProfileSourceSection.tsx`
- Delete: `web/components/settings/ProfileCardioSection.tsx`

- [ ] **Step 1 — Réécrire la page profil**

Remplacer entièrement `web/app/(main)/profile/page.tsx` :

```tsx
import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { IdentityCard } from '@/components/settings/IdentityCard'
import { HrCalibrationCard } from '@/components/settings/HrCalibrationCard'
import { HrSourcesPanel } from '@/components/settings/HrSourcesPanel'
import { HrZonesDisplay } from '@/components/settings/HrZonesDisplay'
import type { HrZoneMethod } from '@/lib/health/hr-zones'
import type { CardioState } from '@/components/settings/HrCardioFields'

export default async function ProfilePage() {
  const user     = await getServerUser()
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name,last_name,max_hr,aerobic_threshold_hr,threshold_hr,resting_hr,ftp_watts,weight_kg,year_goal_km,birth_year,hr_zone_method,hr_zones_custom,hr_method_updated_at')
    .eq('id', user!.id)
    .single()

  const { data: connection } = await supabase
    .from('provider_connections')
    .select('athlete_data')
    .eq('user_id', user!.id)
    .eq('provider', 'strava')
    .maybeSingle()

  const athlete = (connection?.athlete_data ?? null) as
    | { firstname?: string; lastname?: string; profile?: string; resting_heart_rate?: number | null }
    | null

  const firstName = profile?.first_name ?? athlete?.firstname ?? null
  const lastName  = profile?.last_name  ?? athlete?.lastname  ?? null
  const avatarUrl = athlete?.profile && athlete.profile !== 'avatar/athlete/large.png' ? athlete.profile : null
  const displayName = firstName ? `${firstName} ${lastName ?? ''}`.trim() : user!.email?.split('@')[0] ?? 'Athlète'

  const initialMethod: HrZoneMethod = (profile?.hr_zone_method as HrZoneMethod) ?? 'seuils'

  const initialState: CardioState = {
    max_hr:               profile?.max_hr               ?? null,
    resting_hr:           profile?.resting_hr           ?? null,
    aerobic_threshold_hr: profile?.aerobic_threshold_hr ?? null,
    threshold_hr:         profile?.threshold_hr         ?? null,
    birth_year:           profile?.birth_year           ?? null,
    hr_zones_custom:      (profile?.hr_zones_custom as CardioState['hr_zones_custom']) ?? null,
  }

  return (
    <div className="px-3 py-3 space-y-3 max-w-lg mx-auto pb-8">
      <div className="px-1">
        <p className="text-[22px] font-black text-trail-text">{displayName}</p>
        <p className="text-[12px] text-trail-muted leading-[16px] mt-1">
          Ce profil calibre tes zones de fréquence cardiaque et améliore l&apos;interprétation de l&apos;effort.
        </p>
      </div>

      <IdentityCard
        firstName={firstName}
        lastName={lastName}
        email={user!.email ?? null}
        avatarUrl={avatarUrl}
        accountCreatedAt={user!.created_at ?? null}
      />

      <HrCalibrationCard
        initial={initialState}
        initialMethod={initialMethod}
        athleteData={athlete ? { resting_heart_rate: athlete.resting_heart_rate ?? null } : null}
      />

      <HrSourcesPanel
        method={initialMethod}
        profile={{
          max_hr:               initialState.max_hr,
          resting_hr:           initialState.resting_hr,
          threshold_hr:         initialState.threshold_hr,
          aerobic_threshold_hr: initialState.aerobic_threshold_hr,
          birth_year:           initialState.birth_year,
        }}
        deduced={{ maxHrObserved: null, restingHrEstimated: null, lthrEstimated: null, computedAt: null }}
        methodUpdatedAt={profile?.hr_method_updated_at ?? null}
      />

      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[10px]">
        <p className="text-[14px] font-bold text-trail-text">Zones FC utilisées</p>
        <HrZonesDisplay
          maxHr={initialState.max_hr}
          restingHr={initialState.resting_hr}
          aerobicThresholdHr={initialState.aerobic_threshold_hr}
          thresholdHr={initialState.threshold_hr}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2 — Supprimer les anciens composants**

```bash
git rm web/components/settings/ProfileSourceSection.tsx
git rm web/components/settings/ProfileCardioSection.tsx
```

- [ ] **Step 3 — Vérifier qu'aucun autre fichier n'importe ces composants**

```bash
cd web && grep -r "ProfileSourceSection\|ProfileCardioSection" --include="*.tsx" --include="*.ts" .
```

Expected: aucun résultat (sinon corriger ces imports).

- [ ] **Step 4 — Compile check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 5 — Lancer la suite de tests complète**

```bash
cd web && npx jest --no-coverage
```

Expected: tous verts.

- [ ] **Step 6 — Lancer le dev server et tester chaque méthode dans le navigateur**

```bash
cd web && npm run dev
```

Manuellement :
- [ ] Page `/profile` se charge sans erreur
- [ ] Sélectionner chaque méthode (1 à 7) → champs affichés cohérents avec la spec
- [ ] Méthode `test30` → bouton ouvre la modale, fermable par × / Esc / clic backdrop
- [ ] Méthode `karvonen` → click sur « i » ouvre le popover, Esc / clic ailleurs le ferme
- [ ] Méthode `auto` sans année → bordure orange sur le champ
- [ ] Méthode `deduced` → fetch `/api/activities/list-for-deduce`, valeurs affichées
- [ ] Méthode `custom` → validation live (erreurs en rouge quand chevauchement)
- [ ] Bouton « Enregistrer » → toast vert puis retour normal
- [ ] Le tableau `HrSourcesPanel` met en avant les bonnes valeurs selon la méthode

- [ ] **Step 7 — Commit final**

```bash
git add web/app/(main)/profile/page.tsx
git commit -m "feat(profile): wire HR calibration card + sources panel, drop legacy components"
```

---

## Self-Review

**Spec coverage** : les 12 sections de la spec sont couvertes — méthodes (T8), champs conditionnels (T9), modale T30 (T5), popover FC repos (T6), panneau sources (T12), modèle de données (T1, T13), déduction Strava (T4, T11), persistance localStorage (T10), validation avant save (T10). Le hors-scope (formules de zones, intl) est respecté — pas de tâche associée.

**Placeholders** : aucun TBD / TODO / « ajouter validation » sans code. Tous les snippets sont complets.

**Type consistency** : `HrZoneMethod` étendu une seule fois (T3), `CardioState` défini dans T9 et réutilisé dans T10/T12/T14, `DeducedValues` défini dans T9 et réutilisé dans T10/T12.

**Migration order** : T1 doit être appliquée AVANT T13 (whitelist API qui réfère aux nouvelles colonnes). Le plan est en ordre — ✅.

**Correction notée** : la spec mentionnait migration 006, mais 006 existe déjà → utilisée la 010 dans le plan.
