# Toggle « Rapport matinal » (auto-ouverture) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter dans Paramètres > Apparence un interrupteur qui active/désactive l'auto-ouverture du rapport matinal au lancement.

**Architecture:** Nouvelle clé localStorage `morning_report_auto_open` synchronisée dans `profiles.ui_preferences` via le `PreferencesProvider` existant (pattern `app_mode`, aucune migration). `MorningReportAutoOpen` (client, monté sur `/dashboard`) consulte cette préférence — valeur SSR fiable + repli localStorage — avant de rediriger. Un switch dans `AppearanceSection` pilote la préférence.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Supabase SSR, Jest.

## Global Constraints

- **Défaut = activé.** Valeur absente / erreur ⇒ auto-ouverture active (comportement actuel préservé).
- **Aucune migration Supabase** : réutiliser la colonne JSONB `profiles.ui_preferences`.
- **Ne PAS committer / pusher sans accord explicite de Franck** (règle CLAUDE.md). Chaque tâche se termine par la vérification ; l'étape « Commit » n'est exécutée que sur demande de Franck.
- **Vérification** : `npx tsc --noEmit` doit passer, `npm run lint` doit passer. Lancer uniquement la suite Jest ciblée (les ~50 tests i18n hors Provider échouent en pré-existant — ne pas s'en alarmer). Toutes les commandes se lancent depuis `web/`.
- **Ne pas toucher** `MorningReportTile`, `DashboardGrid`, `MissionCockpit`, ni la page `/rapport-matinal`.
- Clé exacte, verbatim : `morning_report_auto_open`.

---

### Task 1: Module de préférence `morning-report.ts`

**Files:**
- Create: `web/lib/preferences/morning-report.ts`
- Test: `web/__tests__/lib/preferences/morning-report.test.ts`

**Interfaces:**
- Consumes: rien (nouvelle brique).
- Produces:
  - `MORNING_REPORT_AUTO_OPEN_KEY = 'morning_report_auto_open'`
  - `readMorningReportAutoOpen(): boolean | null` — lit localStorage ; `null` si absent/illisible ; `true`/`false` sinon.
  - `writeMorningReportAutoOpen(enabled: boolean): void`
  - `useMorningReportAutoOpen(initial?: boolean): { enabled: boolean; setEnabled: (v: boolean) => void; mounted: boolean }`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `web/__tests__/lib/preferences/morning-report.test.ts` :

```ts
import {
  MORNING_REPORT_AUTO_OPEN_KEY,
  readMorningReportAutoOpen,
  writeMorningReportAutoOpen,
} from '@/lib/preferences/morning-report'

describe('readMorningReportAutoOpen', () => {
  beforeEach(() => localStorage.clear())

  it('retourne null quand la clé est absente', () => {
    expect(readMorningReportAutoOpen()).toBeNull()
  })

  it('retourne true quand la valeur stockée est true', () => {
    localStorage.setItem(MORNING_REPORT_AUTO_OPEN_KEY, JSON.stringify(true))
    expect(readMorningReportAutoOpen()).toBe(true)
  })

  it('retourne false quand la valeur stockée est false', () => {
    localStorage.setItem(MORNING_REPORT_AUTO_OPEN_KEY, JSON.stringify(false))
    expect(readMorningReportAutoOpen()).toBe(false)
  })

  it('retourne null quand la valeur est illisible', () => {
    localStorage.setItem(MORNING_REPORT_AUTO_OPEN_KEY, 'not-json')
    expect(readMorningReportAutoOpen()).toBeNull()
  })

  it('writeMorningReportAutoOpen persiste un booléen relisible', () => {
    writeMorningReportAutoOpen(false)
    expect(readMorningReportAutoOpen()).toBe(false)
    writeMorningReportAutoOpen(true)
    expect(readMorningReportAutoOpen()).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx jest __tests__/lib/preferences/morning-report.test.ts`
Expected: FAIL — `Cannot find module '@/lib/preferences/morning-report'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `web/lib/preferences/morning-report.ts` (calqué sur `app-mode.ts`) :

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePreferences } from './PreferencesProvider'

// Auto-ouverture du rapport matinal au lancement (redirection /dashboard →
// /rapport-matinal). Stocké dans localStorage (clé synchronisée via
// PreferencesProvider → profiles.ui_preferences, multi-appareils). Défaut :
// activé (valeur absente = true).

export const MORNING_REPORT_AUTO_OPEN_KEY = 'morning_report_auto_open'
const MORNING_REPORT_AUTO_OPEN_EVENT = 'tc:morning-report-auto-open-change'

// Retourne null si la clé est absente/illisible (le défaut « activé » est
// décidé par le consommateur, éventuellement à partir d'une valeur SSR).
export function readMorningReportAutoOpen(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(MORNING_REPORT_AUTO_OPEN_KEY)
    if (raw == null) return null
    const parsed = JSON.parse(raw)
    return typeof parsed === 'boolean' ? parsed : null
  } catch {
    return null
  }
}

export function writeMorningReportAutoOpen(enabled: boolean): void {
  try {
    localStorage.setItem(MORNING_REPORT_AUTO_OPEN_KEY, JSON.stringify(enabled))
  } catch { /* quota / private mode */ }
  // Notifie les consommateurs du même onglet (storage event = cross-tab only).
  window.dispatchEvent(new CustomEvent(MORNING_REPORT_AUTO_OPEN_EVENT))
}

/**
 * Hook client : lit la préférence, réagit aux changements (même onglet +
 * cross-tab), expose un setter qui persiste + déclenche la sync cloud.
 * `initial` = valeur de départ (SSR) utilisée avant montage / si localStorage vide.
 */
export function useMorningReportAutoOpen(initial = true): {
  enabled: boolean
  setEnabled: (v: boolean) => void
  mounted: boolean
} {
  const { notifyChange } = usePreferences()
  const [enabled, setEnabledState] = useState<boolean>(initial)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const sync = () => setEnabledState(readMorningReportAutoOpen() ?? initial)
    sync()
    window.addEventListener(MORNING_REPORT_AUTO_OPEN_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(MORNING_REPORT_AUTO_OPEN_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [initial])

  const setEnabled = useCallback((v: boolean) => {
    writeMorningReportAutoOpen(v)
    setEnabledState(v)
    notifyChange()
  }, [notifyChange])

  return { enabled, setEnabled, mounted }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx jest __tests__/lib/preferences/morning-report.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Vérifier le type-check**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit** *(uniquement sur demande de Franck)*

```bash
git add web/lib/preferences/morning-report.ts web/__tests__/lib/preferences/morning-report.test.ts
git commit -m "feat(settings): module de préférence auto-ouverture rapport matinal"
```

---

### Task 2: Synchronisation cloud + garde de redirection SSR

**Files:**
- Modify: `web/lib/preferences/PreferencesProvider.tsx` (constante `SYNCED_KEYS`, ~ligne 6-15)
- Modify: `web/components/morning-report/MorningReportAutoOpen.tsx`
- Modify: `web/app/(main)/dashboard/page.tsx` (select profiles ~ligne 76-79 ; rendu `<MorningReportAutoOpen>` ~ligne 111)

**Interfaces:**
- Consumes: `readMorningReportAutoOpen` (Task 1).
- Produces: `MorningReportAutoOpen` accepte désormais la prop `initialAutoOpen?: boolean` (défaut `true`).

- [ ] **Step 1: Ajouter la clé à SYNCED_KEYS**

Dans `web/lib/preferences/PreferencesProvider.tsx`, ajouter la clé à la fin du tableau `SYNCED_KEYS` (juste après `'app_mode',`) :

```ts
const SYNCED_KEYS = [
  'cockpit_block_order', 'cockpit_hidden_blocks', 'cockpit_block_widths',
  'charge_block_order', 'charge_hidden_blocks', 'charge_block_widths',
  'plan_block_order', 'plan_hidden_blocks', 'plan_block_widths',
  'courses_block_order', 'courses_hidden_blocks', 'courses_block_widths',
  'cockpit_goals_settings', 'cockpit_goals_targets',
  'charge_sport_filter',
  'whats_new_seen',
  'app_mode',
  'morning_report_auto_open',
]
```

- [ ] **Step 2: Ajouter la garde de préférence dans MorningReportAutoOpen**

Dans `web/components/morning-report/MorningReportAutoOpen.tsx` :

Ajouter l'import en tête (après les imports existants) :

```ts
import { readMorningReportAutoOpen } from '@/lib/preferences/morning-report'
```

Changer la signature pour accepter la nouvelle prop :

```ts
export function MorningReportAutoOpen({
  onboardingCompletedAt,
  initialAutoOpen = true,
}: {
  onboardingCompletedAt?: string | null
  initialAutoOpen?: boolean
}) {
```

Dans le `useEffect`, ajouter la garde **au tout début du `try`**, avant le calcul de `today` :

```ts
    try {
      // Préférence utilisateur : auto-ouverture désactivée ⇒ pas de redirection.
      // localStorage prime (réactif sur l'appareil qui vient de régler) ;
      // repli sur la valeur SSR fiable au 1er rendu / nouvel appareil.
      const autoOpen = readMorningReportAutoOpen() ?? initialAutoOpen
      if (!autoOpen) return

      const today = todayISO()
      // ... (reste inchangé)
```

Enfin, ajouter `initialAutoOpen` au tableau de dépendances du `useEffect` :

```ts
  }, [router, onboardingCompletedAt, initialAutoOpen])
```

- [ ] **Step 3: Fournir la valeur SSR depuis le dashboard**

Dans `web/app/(main)/dashboard/page.tsx`, ajouter `ui_preferences` au `select` profiles existant (celui qui récupère `athleteProfile`, ~ligne 77) :

```ts
    supabase
      .from('profiles')
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, onboarding_completed_at, hr_zone_method, hr_zones_custom, onboarding_discipline, onboarding_mission, ui_preferences')
      .eq('id', user.id)
      .maybeSingle(),
```

Puis, juste avant le `return` (après le calcul de `weekActivities`, ~ligne 91), dériver le défaut :

```ts
  const morningPrefs = (athleteProfile?.ui_preferences ?? {}) as Record<string, unknown>
  const morningAutoOpen = morningPrefs.morning_report_auto_open !== false
```

Enfin, passer la prop au composant (~ligne 111) :

```tsx
      <MorningReportAutoOpen
        onboardingCompletedAt={athleteProfile?.onboarding_completed_at ?? null}
        initialAutoOpen={morningAutoOpen}
      />
```

- [ ] **Step 4: Vérifier le type-check**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Vérifier le lint**

Run: `npm run lint`
Expected: aucune erreur nouvelle.

- [ ] **Step 6: Commit** *(uniquement sur demande de Franck)*

```bash
git add web/lib/preferences/PreferencesProvider.tsx web/components/morning-report/MorningReportAutoOpen.tsx "web/app/(main)/dashboard/page.tsx"
git commit -m "feat(dashboard): l'auto-ouverture du rapport matinal respecte la préférence"
```

---

### Task 3: Switch dans le bloc Apparence + i18n

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts` (type settings ~ligne 453 ; valeurs ~ligne 2144)
- Modify: `web/lib/i18n/dictionaries/en.ts` (valeurs ~ligne 954)
- Modify: `web/components/settings/AppearanceSection.tsx`

**Interfaces:**
- Consumes: `useMorningReportAutoOpen` (Task 1) ; `t.settings.morningReportAutoOpenLabel` / `...Hint`.
- Produces: rendu final du réglage (pas d'interface consommée en aval).

- [ ] **Step 1: Déclarer les clés i18n dans le type (fr.ts)**

Dans `web/lib/i18n/dictionaries/fr.ts`, après la ligne `planAutoPushTitleHint: string` (~453), ajouter :

```ts
    morningReportAutoOpenLabel: string
    morningReportAutoOpenHint: string
```

- [ ] **Step 2: Ajouter les valeurs FR**

Dans `web/lib/i18n/dictionaries/fr.ts`, dans le bloc `settings` (après `themeDescSystem`, ~ligne 2144), ajouter :

```ts
    morningReportAutoOpenLabel: 'Rapport matinal',
    morningReportAutoOpenHint:  'Ouvrir automatiquement le rapport au lancement de l’application',
```

- [ ] **Step 3: Ajouter les valeurs EN**

Dans `web/lib/i18n/dictionaries/en.ts`, dans le bloc `settings` (après `themeDescSystem`, ~ligne 954), ajouter :

```ts
    morningReportAutoOpenLabel: 'Morning report',
    morningReportAutoOpenHint:  'Automatically open the report when the app starts',
```

- [ ] **Step 4: Ajouter le switch dans AppearanceSection**

Dans `web/components/settings/AppearanceSection.tsx` :

Ajouter l'import (après les imports existants) :

```ts
import { useMorningReportAutoOpen } from '@/lib/preferences/morning-report'
```

Dans le corps du composant (après `const router = useRouter()`), ajouter :

```ts
  const morningReport = useMorningReportAutoOpen()
```

Puis, dans le `return`, insérer ce bloc **après** le groupe des chips langue (juste avant le `</>` de fermeture) :

```tsx
      {/* Rapport matinal — auto-ouverture */}
      <div className="mt-[14px] flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-caption font-semibold text-trail-text leading-tight">
            {t.settings.morningReportAutoOpenLabel}
          </p>
          <p className="text-micro text-trail-muted leading-[15px] mt-[2px]">
            {t.settings.morningReportAutoOpenHint}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={morningReport.enabled}
          aria-label={t.settings.morningReportAutoOpenLabel}
          onClick={() => morningReport.setEnabled(!morningReport.enabled)}
          className={
            'relative inline-flex flex-shrink-0 h-[22px] w-[40px] items-center rounded-full transition-colors ' +
            (morningReport.enabled ? 'bg-trail-primary' : 'bg-trail-border')
          }
          style={{ visibility: morningReport.mounted ? 'visible' : 'hidden' }}
        >
          <span
            className={
              'inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ' +
              (morningReport.enabled ? 'translate-x-[20px]' : 'translate-x-[2px]')
            }
          />
        </button>
      </div>
```

- [ ] **Step 5: Vérifier le type-check**

Run: `npx tsc --noEmit`
Expected: aucune erreur (les deux dictionnaires doivent satisfaire le type ⇒ garantit la parité fr/en).

- [ ] **Step 6: Vérifier le lint**

Run: `npm run lint`
Expected: aucune erreur nouvelle.

- [ ] **Step 7: Test manuel**

Depuis `web/` : `npm run dev`, puis dans le navigateur :
1. Réglages → bloc Apparence : le switch « Rapport matinal » est visible, **activé** par défaut.
2. Désactiver le switch → recharger `/dashboard` : **aucune** redirection vers `/rapport-matinal`.
3. Réactiver → vider `localStorage.morning_report_seen_<date>` (ou changer de jour) → recharger `/dashboard` : redirection présente.
4. La tuile « Rapport matinal » reste visible sur le Cockpit dans les deux cas.

- [ ] **Step 8: Commit** *(uniquement sur demande de Franck)*

```bash
git add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts web/components/settings/AppearanceSection.tsx
git commit -m "feat(settings): switch Rapport matinal dans le bloc Apparence"
```

---

## Self-Review

**Spec coverage :**
- Objectif / portée « auto-ouverture seulement » → Task 2 (garde) + Task 3 (switch). ✔
- Stockage `morning_report_auto_open` + SYNCED_KEYS → Task 1 + Task 2 Step 1. ✔
- Fiabilité SSR + repli localStorage → Task 2 Step 2-3. ✔
- 6 fichiers touchés → Task 1 (1 créé + 1 test), Task 2 (3 modifiés), Task 3 (3 modifiés). ✔
- Défaut activé → `initial = true`, `!== false`, `?? initialAutoOpen`. ✔
- Aucune migration ; tuile/page intactes → aucune tâche ne les touche. ✔

**Type consistency :** `readMorningReportAutoOpen(): boolean | null`, `initialAutoOpen?: boolean`, `useMorningReportAutoOpen(initial = true)` — noms et signatures cohérents entre Task 1, 2 et 3.

**Placeholders :** aucun — chaque step porte le code réel.
