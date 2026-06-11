# Stratégie d'allure — curseur parlant (courbe live) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le champ obscur « Fade 2e moitié » par un curseur parlant (Finir fort ↔ Partir vite) posé au-dessus du tableau de course, avec courbe d'allure live et explication du calcul.

**Architecture:** Un helper pur `segmentPaces` (porté/dérivé de `estimatePassageTimes`) alimente une carte client `PacingStrategyCard` insérée dans `CoursePageClient`. Le curseur pilote `race.pacingFade` (state local → recalcul live de la courbe ET du `WaypointsTable` déjà branché), persisté en debounce via `saveRace`. Aucune migration (colonne `numeric`, négatif autorisé).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind (tokens `trail-*`), Jest. i18n maison (`useT().plan`).

**Spec:** `docs/superpowers/specs/2026-06-11-strategie-allure-curseur-design.md`

**Pré-requis d'exécution (git) :** cette feature est sans rapport avec la branche courante `feat/broaden-race-find`. Avant la 1re tâche, créer une branche dédiée `feat/pacing-strategy-curve` (depuis `master`, après avoir mis de côté/committé le travail en cours). À confirmer avec Franck au lancement — ne pas committer sur `feat/broaden-race-find`.

---

## File Structure

- **Create** `web/components/plan/PacingStrategyCard.tsx` — carte client : curseur + phrase + courbe SVG + encart méthode. Responsabilité unique : régler/visualiser la stratégie d'allure.
- **Modify** `web/lib/plan/pacing.ts` — ajouter le helper pur `segmentPaces`.
- **Modify** `web/__tests__/lib/plan/pacing.test.ts` — tests du helper.
- **Modify** `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` — state `pacingFade`, debounce save, insertion de la carte.
- **Modify** `web/components/plan/RaceEditorModal.tsx` — retrait du champ fade + section « Réglages avancés ».
- **Modify** `web/lib/i18n/dictionaries/fr.ts` + `web/lib/i18n/dictionaries/en.ts` — clés `pacing*` (ajout) ; `raceEditFieldFade` / `raceEditAdvanced` (retrait, type + valeurs).

---

## Task 1: Helper pur `segmentPaces` (+ tests)

**Files:**
- Modify: `web/lib/plan/pacing.ts`
- Test: `web/__tests__/lib/plan/pacing.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `web/__tests__/lib/plan/pacing.test.ts`, modifier la 1re ligne d'import pour ajouter `segmentPaces` :

```ts
import { estimatePassageTimes, segmentPaces, type PacingWaypoint } from '@/lib/plan/pacing'
```

Puis ajouter ce bloc à la fin du fichier (le helper `flat` défini en haut du fichier est réutilisé) :

```ts
describe('segmentPaces', () => {
  it('renvoie un tableau aligné aux waypoints, pace[0] = 0', () => {
    const out = segmentPaces(flat([0, 10, 20]), { totalDurationSec: 7200, fade: 0 })
    expect(out).toHaveLength(3)
    expect(out[0]).toBe(0)
  })

  it('tronçon plus pentu = allure (s/km) plus lente', () => {
    const wps: PacingWaypoint[] = [
      { km: 0, dPlus: 0, targetOverrideSec: null },
      { km: 10, dPlus: 1000, targetOverrideSec: null }, // pentu
      { km: 20, dPlus: 1000, targetOverrideSec: null }, // plat
    ]
    const out = segmentPaces(wps, { totalDurationSec: 7200, fade: 0 })
    expect(out[1]).toBeGreaterThan(out[2])
  })

  it('fade > 0 ralentit les allures de la 2e moitié (et accélère la 1re)', () => {
    const even = segmentPaces(flat([0, 10, 20]), { totalDurationSec: 7200, fade: 0 })
    const faded = segmentPaces(flat([0, 10, 20]), { totalDurationSec: 7200, fade: 1 })
    expect(faded[2]).toBeGreaterThan(even[2])
    expect(faded[1]).toBeLessThan(even[1])
  })

  it('deux points au même km → 0 (pas de division par zéro)', () => {
    const wps: PacingWaypoint[] = [
      { km: 0, dPlus: 0, targetOverrideSec: null },
      { km: 0, dPlus: 0, targetOverrideSec: null },
      { km: 10, dPlus: 0, targetOverrideSec: null },
    ]
    const out = segmentPaces(wps, { totalDurationSec: 3600, fade: 0 })
    expect(out[1]).toBe(0)
    expect(Number.isFinite(out[2])).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/pacing.test.ts`
Expected: FAIL — `segmentPaces is not a function` (ou erreur d'import TS).

- [ ] **Step 3: Implémenter le helper**

Ajouter à la fin de `web/lib/plan/pacing.ts` (après `estimatePassageTimes`) :

```ts
// Allure (s/km) de chaque tronçon i (1..n-1), dérivée des temps de passage.
// Index 0 = 0 (le point de départ n'a pas de tronçon entrant). Deux points au
// même km → 0 (garde-fou anti division par zéro). Sert à tracer la courbe live.
export function segmentPaces(
  waypoints: PacingWaypoint[],
  opts: PacingOptions,
): number[] {
  const elapsed = estimatePassageTimes(waypoints, opts)
  const paces: number[] = new Array(waypoints.length).fill(0)
  for (let i = 1; i < waypoints.length; i++) {
    const dKm = waypoints[i].km - waypoints[i - 1].km
    paces[i] = dKm > 0 ? (elapsed[i] - elapsed[i - 1]) / dKm : 0
  }
  return paces
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/pacing.test.ts`
Expected: PASS (tous les `estimatePassageTimes` + 4 nouveaux `segmentPaces`).

- [ ] **Step 5: Commit**

```bash
git add web/lib/plan/pacing.ts web/__tests__/lib/plan/pacing.test.ts
git commit -m "feat(plan): segmentPaces (allure par tronçon) pour la courbe de stratégie d'allure"
```

---

## Task 2: Clés i18n (ajout `pacing*`, retrait `raceEditFieldFade`/`raceEditAdvanced`)

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts` (type `Dict` + valeurs FR)
- Modify: `web/lib/i18n/dictionaries/en.ts` (valeurs EN)

- [ ] **Step 1: Étendre le type `Dict` (fr.ts)**

Dans `web/lib/i18n/dictionaries/fr.ts`, dans le bloc de type du `plan`, juste après la ligne `objectifTitle: string; objectifHelpTitle: string; objectifHelp: string`, ajouter :

```ts
    pacingTitle: string
    pacingScaleStart: string; pacingScaleMid: string; pacingScaleEnd: string
    pacingPhraseEven: string
    pacingPhraseNeg: (intensity: string) => string
    pacingPhrasePos: (intensity: string) => string
    pacingIntLight: string; pacingIntModerate: string; pacingIntStrong: string
    pacingMethodSummary: string; pacingMethodFormula: string; pacingMethodBody: string
    pacingCurveLegendPace: string; pacingCurveLegendElev: string
```

Dans le même type, **supprimer** les deux lignes :

```ts
    raceEditFieldFade: string
    raceEditAdvanced: string
```

- [ ] **Step 2: Ajouter les valeurs FR (fr.ts)**

Toujours dans `fr.ts`, dans l'objet `plan` FR, juste après la ligne `objectifHelp:        "Définis la course principale … en saison.",` ajouter :

```ts
    pacingTitle:          "Stratégie d'allure",
    pacingScaleStart:     'Finir fort',
    pacingScaleMid:       'Régulier',
    pacingScaleEnd:       'Partir vite',
    pacingPhraseEven:     'Effort régulier — réparti selon le dénivelé, sans accélérer ni ralentir volontairement.',
    pacingPhraseNeg:      (i: string) => `Négatif split — départ prudent pour finir plus vite (intensité ${i}).`,
    pacingPhrasePos:      (i: string) => `Positif split — tu prends de l'avance et tu ralentis sur la fin (intensité ${i}).`,
    pacingIntLight:       'légère',
    pacingIntModerate:    'modérée',
    pacingIntStrong:      'marquée',
    pacingMethodSummary:  "Comment c'est calculé ?",
    pacingMethodFormula:  'effort = distance + D+ ÷ 100',
    pacingMethodBody:     "Chaque tronçon reçoit une part du temps total proportionnelle à son effort (100 m de montée ≈ 1 km à plat). Le curseur incline cette répartition ; les heures que tu fixes à la main dans le tableau restent des points d'ancrage.",
    pacingCurveLegendPace:'Allure visée',
    pacingCurveLegendElev:'Dénivelé',
```

Dans le même objet `plan` FR, **supprimer** les deux lignes :

```ts
    raceEditFieldFade:        'Fade 2e moitié',
    raceEditAdvanced:         'Réglages avancés',
```

- [ ] **Step 3: Ajouter les valeurs EN + retrait (en.ts)**

Dans `web/lib/i18n/dictionaries/en.ts`, dans l'objet `plan` EN, juste après la ligne `objectifTitle:       'Race goal',` ajouter :

```ts
    pacingTitle:          'Pacing strategy',
    pacingScaleStart:     'Finish strong',
    pacingScaleMid:       'Even',
    pacingScaleEnd:       'Start fast',
    pacingPhraseEven:     'Even effort — distributed by elevation, without speeding up or slowing down on purpose.',
    pacingPhraseNeg:      (i: string) => `Negative split — cautious start to finish faster (${i} intensity).`,
    pacingPhrasePos:      (i: string) => `Positive split — you build a lead and slow down toward the end (${i} intensity).`,
    pacingIntLight:       'light',
    pacingIntModerate:    'moderate',
    pacingIntStrong:      'strong',
    pacingMethodSummary:  'How is it calculated?',
    pacingMethodFormula:  'effort = distance + D+ ÷ 100',
    pacingMethodBody:     'Each segment gets a share of the total time proportional to its effort (100 m of climb ≈ 1 km flat). The slider tilts that distribution; the times you set by hand in the table stay as anchors.',
    pacingCurveLegendPace:'Target pace',
    pacingCurveLegendElev:'Elevation',
```

Dans le même objet `plan` EN, **supprimer** les deux lignes :

```ts
    raceEditFieldFade:        'Second-half fade',
    raceEditAdvanced:         'Advanced settings',
```

- [ ] **Step 4: Vérifier la cohérence des types**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: aucune erreur sur `fr.ts` / `en.ts` (les deux dictionnaires satisfont le même type). Une erreur `raceEditFieldFade`/`raceEditAdvanced` dans `RaceEditorModal.tsx` est **attendue** ici (corrigée Task 5) — elle confirme qu'il n'y a pas d'autre usage.

- [ ] **Step 5: Commit**

```bash
git add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts
git commit -m "i18n(plan): clés stratégie d'allure, retrait des clés fade/avancé"
```

---

## Task 3: Composant `PacingStrategyCard`

**Files:**
- Create: `web/components/plan/PacingStrategyCard.tsx`

- [ ] **Step 1: Créer le composant**

Créer `web/components/plan/PacingStrategyCard.tsx` avec exactement :

```tsx
'use client'

// Bloc « Stratégie d'allure » — curseur parlant (Finir fort ↔ Partir vite), façon
// PacePro, posé au-dessus du tableau de course. Recalcule en live une courbe
// d'allure par tronçon superposée au profil dénivelé, et pilote pacingFade (qui
// alimente aussi WaypointsTable). Style scoped (même pattern que WaypointsTable).

import { useMemo } from 'react'
import { segmentPaces } from '@/lib/plan/pacing'
import { useT } from '@/lib/i18n/I18nProvider'

const FADE_MAX = 1.2

export type PacingStrategyWaypoint = {
  km: number
  dPlus: number | null
  targetOverrideSec: number | null
}

type Props = {
  waypoints: PacingStrategyWaypoint[]
  targetDurationMin: number
  pacingFade: number
  onChange: (fade: number) => void
  readOnly?: boolean
}

const clampFade = (f: number) => Math.max(-FADE_MAX, Math.min(FADE_MAX, f))
const sliderFromFade = (f: number) => Math.round((clampFade(f) / FADE_MAX) * 100)
const fadeFromSlider = (v: number) => clampFade((v / 100) * FADE_MAX)

type CurvePaths = { elevArea: string; paceLine: string } | null

function buildCurvePaths(
  waypoints: PacingStrategyWaypoint[],
  totalSec: number,
  fade: number,
): CurvePaths {
  const n = waypoints.length
  if (n < 2) return null
  const totalKm = waypoints[n - 1].km - waypoints[0].km
  if (totalKm <= 0) return null
  const W = 300, H = 120, padX = 4
  const x = (km: number) => padX + ((km - waypoints[0].km) / totalKm) * (W - 2 * padX)

  const maxDp = Math.max(1, ...waypoints.map((w) => w.dPlus ?? 0))
  let elevArea = `M ${x(waypoints[0].km).toFixed(1)} ${H} `
  waypoints.forEach((w) => {
    const y = H - ((w.dPlus ?? 0) / maxDp) * (H * 0.55)
    elevArea += `L ${x(w.km).toFixed(1)} ${y.toFixed(1)} `
  })
  elevArea += `L ${x(waypoints[n - 1].km).toFixed(1)} ${H} Z`

  const paces = segmentPaces(waypoints, { totalDurationSec: totalSec, fade })
  const seg = paces.slice(1)
  const pMin = Math.min(...seg), pMax = Math.max(...seg)
  const span = Math.max(1, pMax - pMin)
  const yPace = (p: number) => 12 + ((p - pMin) / span) * (H * 0.6)
  let paceLine = ''
  for (let i = 1; i < n; i++) {
    const x0 = x(waypoints[i - 1].km), x1 = x(waypoints[i].km)
    const yv = yPace(paces[i])
    if (i === 1) paceLine += `M ${x0.toFixed(1)} ${yv.toFixed(1)} `
    paceLine += `L ${x1.toFixed(1)} ${yv.toFixed(1)} `
  }
  return { elevArea, paceLine }
}

export function PacingStrategyCard({
  waypoints, targetDurationMin, pacingFade, onChange, readOnly,
}: Props) {
  const L = useT().plan
  const totalSec = targetDurationMin * 60
  const fade = clampFade(pacingFade ?? 0)

  const curve = useMemo(
    () => buildCurvePaths(waypoints, totalSec, fade),
    [waypoints, totalSec, fade],
  )

  const phrase = useMemo(() => {
    if (Math.abs(fade) < 0.08) return L.pacingPhraseEven
    const pct = Math.round((Math.abs(fade) / FADE_MAX) * 100)
    const intensity = pct < 40 ? L.pacingIntLight : pct < 75 ? L.pacingIntModerate : L.pacingIntStrong
    return fade < 0 ? L.pacingPhraseNeg(intensity) : L.pacingPhrasePos(intensity)
  }, [fade, L])

  const totalKm = waypoints.length >= 2 ? waypoints[waypoints.length - 1].km - waypoints[0].km : 0

  return (
    <div className="pstrat rounded-[12px] bg-trail-card border border-trail-border p-4 mb-3">
      <style>{`
        .pstrat .prange{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:6px;outline:none;cursor:pointer;
          background:linear-gradient(90deg,#38BDF8 0%,var(--trail-border) 50%,var(--trail-primary) 100%);}
        .pstrat .prange::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--trail-text);border:3px solid var(--trail-card);box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:grab;}
        .pstrat .prange::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--trail-text);border:3px solid var(--trail-card);cursor:grab;}
        .pstrat .prange:disabled{opacity:.6;cursor:default;}
        .pstrat .pcurve{width:100%;height:120px;display:block;}
        .pstrat summary::-webkit-details-marker{display:none;}
      `}</style>

      <h2 className="text-body font-semibold text-trail-muted mb-3 font-display">{L.pacingTitle}</h2>

      <div className="flex justify-between text-[9.5px] font-semibold uppercase tracking-wide text-trail-muted mb-1.5 font-display">
        <span>{L.pacingScaleStart}</span>
        <span className="text-trail-text">{L.pacingScaleMid}</span>
        <span>{L.pacingScaleEnd}</span>
      </div>
      <input
        type="range" min={-100} max={100} step={1}
        className="prange"
        value={sliderFromFade(fade)}
        disabled={readOnly}
        onChange={(e) => onChange(fadeFromSlider(Number(e.target.value)))}
        aria-label={L.pacingTitle}
      />

      <p className="text-body-sm text-trail-text mt-3 leading-snug">{phrase}</p>

      {curve && (
        <div className="mt-3 rounded-[10px] bg-trail-surface border border-trail-border p-2">
          <div className="flex gap-3 text-[9.5px] font-semibold text-trail-muted mb-1 px-1 font-display">
            <span><i className="inline-block w-2.5 h-[3px] rounded-sm align-middle mr-1" style={{ background: 'var(--trail-primary)' }} />{L.pacingCurveLegendPace}</span>
            <span><i className="inline-block w-2.5 h-[3px] rounded-sm align-middle mr-1" style={{ background: '#38BDF8' }} />{L.pacingCurveLegendElev}</span>
          </div>
          <svg className="pcurve" viewBox="0 0 300 120" preserveAspectRatio="none">
            <path d={curve.elevArea} fill="rgba(56,189,248,.14)" stroke="rgba(56,189,248,.5)" strokeWidth={1} />
            <path d={curve.paceLine} fill="none" stroke="var(--trail-primary)" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className="flex justify-between text-[9px] text-trail-muted pt-0.5 px-0.5 font-display">
            <span>0 km</span>
            <span>{Math.round(totalKm / 2)} km</span>
            <span>{Math.round(totalKm)} km</span>
          </div>
        </div>
      )}

      <details className="mt-3 border-t border-trail-border pt-2.5">
        <summary className="cursor-pointer text-caption font-semibold font-display list-none" style={{ color: '#38BDF8' }}>
          {L.pacingMethodSummary}
        </summary>
        <div className="mt-2 text-caption text-trail-muted leading-relaxed">
          <div className="font-display font-semibold text-trail-text bg-trail-surface border border-trail-border rounded-[7px] px-2 py-1.5 my-1.5 inline-block">
            {L.pacingMethodFormula}
          </div>
          <p>{L.pacingMethodBody}</p>
        </div>
      </details>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier la compilation du composant**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: aucune nouvelle erreur dans `PacingStrategyCard.tsx` (l'erreur `RaceEditorModal.tsx` de Task 2 reste, corrigée Task 5).

- [ ] **Step 3: Commit**

```bash
git add web/components/plan/PacingStrategyCard.tsx
git commit -m "feat(plan): composant PacingStrategyCard (curseur + courbe live)"
```

---

## Task 4: Intégration dans `CoursePageClient`

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`

- [ ] **Step 1: Importer `saveRace` et le composant**

Remplacer la ligne d'import storage :

```tsx
import { getRaces, deleteRace, peekRaces } from '@/lib/plan/storage'
```

par :

```tsx
import { getRaces, deleteRace, peekRaces, saveRace } from '@/lib/plan/storage'
```

Et ajouter, sous l'import `WaypointsTable` :

```tsx
import { PacingStrategyCard } from '@/components/plan/PacingStrategyCard'
```

- [ ] **Step 2: Ajouter le handler de changement de fade (debounce save)**

Juste après le bloc `handleWaypointsChange` (la `useCallback` qui se termine par `[raceId, waypoints],\n  )`), ajouter :

```tsx
  const pacingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlePacingChange = useCallback(
    (fade: number) => {
      if (!race) return
      const next = { ...race, pacingFade: fade }
      setRace(next)
      if (pacingTimer.current) clearTimeout(pacingTimer.current)
      pacingTimer.current = setTimeout(() => { void saveRace(next) }, 600)
    },
    [race],
  )
```

(`useRef`, `useCallback` sont déjà importés ligne 3.)

- [ ] **Step 3: Insérer la carte au-dessus du tableau**

Dans le JSX, repérer la fin de la barre Objectif (le `</div>` qui ferme `<div className="mb-3 flex items-center justify-between …">`) juste avant `<WaypointsTable`. Insérer **entre les deux** :

```tsx
            {race.targetDurationMin != null && (
              <PacingStrategyCard
                waypoints={waypoints.map(({ km, dPlus, targetOverrideSec }) => ({ km, dPlus, targetOverrideSec }))}
                targetDurationMin={race.targetDurationMin}
                pacingFade={race.pacingFade ?? 0}
                onChange={handlePacingChange}
              />
            )}
```

Le bloc doit se trouver immédiatement avant :

```tsx
            <WaypointsTable
              waypoints={waypoints.map(({ id: _id, raceId: _rid, ...rest }) => rest)}
```

- [ ] **Step 4: Vérifier compilation**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: pas d'erreur TS dans `CoursePageClient.tsx` (l'erreur `RaceEditorModal.tsx` de Task 2 reste jusqu'à Task 5 ; lint complet en Task 5).

- [ ] **Step 5: Commit**

```bash
git add "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx"
git commit -m "feat(plan): brancher PacingStrategyCard au-dessus du tableau (recalcul live + save debounce)"
```

---

## Task 5: Retrait du champ fade de `RaceEditorModal`

**Files:**
- Modify: `web/components/plan/RaceEditorModal.tsx`

- [ ] **Step 1: Supprimer le bloc « Réglages avancés »**

Dans `web/components/plan/RaceEditorModal.tsx`, supprimer entièrement ce bloc (actuellement ~lignes 290-308) :

```tsx
          <details className="rounded-[10px] bg-trail-surface border border-trail-border px-3 py-2">
            <summary className="text-caption font-semibold text-trail-muted cursor-pointer">
              {L.raceEditAdvanced}
            </summary>
            <div className="mt-2">
              <Field label={L.raceEditFieldFade}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={2}
                  value={draft.pacingFade ?? 0}
                  onChange={(e) => setDraft({ ...draft, pacingFade: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
                />
              </Field>
            </div>
          </details>
```

Ne pas toucher au reste : `pacingFade: 0` reste dans `emptyDraft()` et `draft` est sauvegardé tel quel (le curseur de la page détail pilote désormais la valeur).

- [ ] **Step 2: Vérifier compilation + lint (tout vert maintenant)**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx next lint`
Expected: **0 erreur** (les références `raceEditFieldFade` / `raceEditAdvanced` ont disparu, plus aucune clé manquante).

- [ ] **Step 3: Lancer la suite de tests pertinente**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/pacing.test.ts`
Expected: PASS.

(Note : ~50 tests jest échouent en pré-existant — `useI18n` hors `I18nProvider` — sans rapport avec ce changement ; ne pas lancer toute la suite.)

- [ ] **Step 4: Commit**

```bash
git add web/components/plan/RaceEditorModal.tsx
git commit -m "refactor(plan): retirer le champ fade de la modal (remplacé par le curseur)"
```

---

## Vérification finale (manuelle)

- [ ] `cd web && npx tsc --noEmit && npx next lint` → 0 erreur.
- [ ] `cd web && npx jest __tests__/lib/plan/pacing.test.ts` → vert.
- [ ] `npm run dev` → page détail d'une course **avec objectif défini** + tableau importé :
  - la carte « Stratégie d'allure » apparaît au-dessus du tableau ;
  - bouger le curseur recalcule **la courbe** ET **la colonne Obj** du tableau en direct ;
  - la dernière ligne (arrivée) ne bouge pas (= objectif) ;
  - fixer une heure à la main dans le tableau (override) : elle reste ancrée quand on bouge le curseur ;
  - recharger la page : la position du curseur est conservée (save OK) ;
  - course **sans objectif** : la carte n'apparaît pas (CTA « Définir l'objectif » inchangée).
- [ ] Modal d'édition course : plus de section « Réglages avancés ».

---

## Notes d'implémentation

- **Pas de migration** : `races.pacing_fade` est `numeric not null default 0` sans CHECK → le négatif (négatif split) passe.
- **Mapping curseur** : `fade = (v/100) × 1,2`, plage ±1,2, défaut 0 (régulier). Borné côté composant ET côté moteur (`estimatePassageTimes` clampe le facteur à 0.05).
- **Doc upkeep** : ce plan touche le pacing/objectif de course — penser à mettre à jour la spec liée (`docs/superpowers/specs/2026-06-11-strategie-allure-curseur-design.md`) avec le bandeau `Status: Implémenté` + chemin code une fois livré.
