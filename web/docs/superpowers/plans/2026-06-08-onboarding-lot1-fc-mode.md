# Onboarding fonctionnel — Lot 1 (Étape Zones FC + Mode défaut) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une étape « Zones FC » à l'onboarding (anti-friction, corrige intensité/charge/fraîcheur) et faire que le Mode choisi pilote réellement `app_mode` au premier lancement du cockpit.

**Architecture:** Le flow passe de 5 à 6 étapes (`Bienvenue → Discipline → Mission → Mode → Zones FC → Données`). L'étape FC écrit **directement** dans le vrai profil (`hr_zone_method`, `max_hr`, `birth_year`) via le `PATCH /api/profile` existant — pas de colonne `onboarding_*` dédiée. Le Mode est **semé** dans `profiles.ui_preferences.app_mode` au moment de la complétion (chemin sans-Strava via `/api/profile`, chemin Strava via le callback) ; `PreferencesProvider.hydrate()` recopie ensuite cette valeur dans le localStorage du dashboard, ce qui rend client et serveur cohérents.

**Tech Stack:** Next.js 14 App Router, TypeScript, React, Supabase (`@supabase/ssr`), Jest + Testing Library.

**Périmètre :** Lot 1 uniquement. **Aucune migration SQL** (les colonnes `hr_zone_method`, `max_hr`, `birth_year` existent et sont déjà dans l'allowlist de `/api/profile`). Les lots Discipline/Mission/Réglages/Import sont hors de ce plan.

**Référence spec :** `web/docs/superpowers/specs/2026-06-08-onboarding-fonctionnel-design.md` (sections ③ Mode, ⑤ Zones FC, proposition A).

**Note exécution (lesson 2026-06-05) :** les subagents implémenteurs n'exécutent **aucune** commande git (ni add, ni commit, ni checkout/push). Le contrôleur fait tous les commits sur la branche feature après `git rev-parse --abbrev-ref HEAD`.

**Branche :** créer `feat/onboarding-lot1-fc-mode` depuis `master` avant la Task 1 (le repo est sur `master`, branche de déploiement Vercel — ne jamais committer Lot 1 directement sur `master`).

---

### Task 1: Helper pur de seed `app_mode`

**Files:**
- Create: `web/lib/profile/seed-app-mode.ts`
- Test: `web/__tests__/lib/profile/seed-app-mode.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// web/__tests__/lib/profile/seed-app-mode.test.ts
import { seedAppModePreferences } from '@/lib/profile/seed-app-mode'

describe('seedAppModePreferences', () => {
  it('sème app_mode dans des préférences vides', () => {
    expect(seedAppModePreferences(null, 'mission')).toEqual({ app_mode: 'mission' })
    expect(seedAppModePreferences(undefined, 'expert')).toEqual({ app_mode: 'expert' })
  })

  it('merge sans écraser les autres clés', () => {
    const current = { cockpit_block_order: ['a', 'b'], whats_new_seen: true }
    expect(seedAppModePreferences(current, 'mission')).toEqual({
      cockpit_block_order: ['a', 'b'],
      whats_new_seen: true,
      app_mode: 'mission',
    })
  })

  it('retourne null pour un mode invalide (→ ne rien écrire)', () => {
    expect(seedAppModePreferences(null, 'libre')).toBeNull()
    expect(seedAppModePreferences(null, null)).toBeNull()
    expect(seedAppModePreferences(null, undefined)).toBeNull()
  })

  it('retourne null si app_mode est déjà défini (ne réécrase pas un choix existant)', () => {
    expect(seedAppModePreferences({ app_mode: 'expert' }, 'mission')).toBeNull()
    expect(seedAppModePreferences({ app_mode: 'mission' }, 'expert')).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run (depuis `web/`, cf. memory cwd) :
```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/profile/seed-app-mode.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/profile/seed-app-mode'`.

- [ ] **Step 3: Implémenter le helper minimal**

```ts
// web/lib/profile/seed-app-mode.ts
import type { AppMode } from '@/lib/preferences/app-mode'

/**
 * Construit l'objet `ui_preferences` à écrire pour SEMER `app_mode` depuis le
 * choix d'onboarding (Mode Mission/Expert).
 *
 * - Retourne `null` (→ ne rien écrire) si `mode` n'est pas un AppMode valide,
 *   ou si `app_mode` est déjà défini dans les préférences (on ne réécrase
 *   jamais un choix existant).
 * - Sinon retourne une copie non destructive de `current` avec `app_mode` posé.
 */
export function seedAppModePreferences(
  current: Record<string, unknown> | null | undefined,
  mode: unknown,
): Record<string, unknown> | null {
  if (mode !== 'mission' && mode !== 'expert') return null
  const prefs = current ?? {}
  if (prefs.app_mode === 'mission' || prefs.app_mode === 'expert') return null
  return { ...prefs, app_mode: mode as AppMode }
}
```

- [ ] **Step 4: Lancer le test → succès attendu**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/profile/seed-app-mode.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit** (contrôleur uniquement)

```
git add web/lib/profile/seed-app-mode.ts web/__tests__/lib/profile/seed-app-mode.test.ts
git commit -m "feat(onboarding): helper pur seedAppModePreferences (Lot 1)"
```

---

### Task 2: Semer `app_mode` à la complétion sans-Strava (`/api/profile`)

**Files:**
- Modify: `web/app/api/profile/route.ts`

Le `PATCH /api/profile` reçoit, au moment « Entrer dans le cockpit » (chemin sans-Strava), `{ onboarding_discipline, onboarding_mission, onboarding_mode, onboarding_data_source, onboarding_complete: true }`. On sème `app_mode` depuis `onboarding_mode` **uniquement** quand la complétion est posée.

- [ ] **Step 1: Ajouter l'import du helper**

En tête de `web/app/api/profile/route.ts`, après l'import de `onboardingCompletionPatch` :

```ts
import { seedAppModePreferences } from '@/lib/profile/seed-app-mode'
```

- [ ] **Step 2: Remplacer le bloc de complétion par la version qui sème le mode**

Remplacer ces lignes (actuellement vers `route.ts:38`) :

```ts
  Object.assign(update, onboardingCompletionPatch(body))
```

par :

```ts
  const completion = onboardingCompletionPatch(body)
  Object.assign(update, completion)

  // Seed app_mode (Lot 1) : à la complétion d'onboarding, on sème le Mode choisi
  // dans ui_preferences.app_mode. hydrate() le recopiera en localStorage côté
  // dashboard → cockpit (SSR) et nav (client) cohérents. Lecture-merge pour ne
  // pas écraser les autres préférences.
  if (completion.onboarding_completed_at && 'onboarding_mode' in body) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('ui_preferences')
      .eq('id', user.id)
      .maybeSingle()
    const seeded = seedAppModePreferences(
      (prof?.ui_preferences ?? null) as Record<string, unknown> | null,
      body.onboarding_mode,
    )
    if (seeded) update.ui_preferences = seeded
  }
```

(Le reste du handler — `supabase.from('profiles').update(update).eq('id', user.id)` — est inchangé.)

- [ ] **Step 3: Vérifier la compilation TypeScript**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: aucune erreur sur `route.ts`.

- [ ] **Step 4: Commit**

```
git add web/app/api/profile/route.ts
git commit -m "feat(onboarding): seed app_mode à la complétion sans-Strava (Lot 1)"
```

---

### Task 3: Semer `app_mode` à la complétion via Strava (callback)

**Files:**
- Modify: `web/app/api/strava/callback/route.ts` (bloc `if (from === 'onboarding')`, vers `route.ts:71-79`)

Sur le chemin Strava, la complétion est posée côté serveur dans le callback. `onboarding_mode` a déjà été persisté à l'étape Mode (via `selectAndPersist`), donc on le relit ici.

- [ ] **Step 1: Ajouter l'import du helper**

En tête de `web/app/api/strava/callback/route.ts` :

```ts
import { seedAppModePreferences } from '@/lib/profile/seed-app-mode'
```

- [ ] **Step 2: Remplacer le bloc de complétion onboarding**

Remplacer :

```ts
    if (from === 'onboarding') {
      const { error: completionError } = await supabase
        .from('profiles')
        .update({ onboarding_completed_at: now, onboarding_data_source: 'strava' })
        .eq('id', user.id)
      // Non bloquant : la connexion a réussi. Si l'update échoue, l'user
      // retombe sur /onboarding (étape Données) — récupérable, pas de perte.
      if (completionError) console.error('Onboarding completion update failed:', completionError)
    }
```

par :

```ts
    if (from === 'onboarding') {
      // Relit onboarding_mode (persisté à l'étape Mode) + ui_preferences pour
      // semer app_mode (Lot 1), sans écraser les autres préférences.
      const { data: prof } = await supabase
        .from('profiles')
        .select('onboarding_mode, ui_preferences')
        .eq('id', user.id)
        .maybeSingle()
      const completionUpdate: Record<string, unknown> = {
        onboarding_completed_at: now,
        onboarding_data_source: 'strava',
      }
      const seeded = seedAppModePreferences(
        (prof?.ui_preferences ?? null) as Record<string, unknown> | null,
        prof?.onboarding_mode,
      )
      if (seeded) completionUpdate.ui_preferences = seeded
      const { error: completionError } = await supabase
        .from('profiles')
        .update(completionUpdate)
        .eq('id', user.id)
      // Non bloquant : la connexion a réussi. Si l'update échoue, l'user
      // retombe sur /onboarding (étape Données) — récupérable, pas de perte.
      if (completionError) console.error('Onboarding completion update failed:', completionError)
    }
```

- [ ] **Step 3: Vérifier la compilation TypeScript**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```
git add web/app/api/strava/callback/route.ts
git commit -m "feat(onboarding): seed app_mode au callback Strava onboarding (Lot 1)"
```

---

### Task 4: Étape « Zones FC » dans MissionSetupFlow (flow 6 étapes)

**Files:**
- Modify: `web/components/onboarding/mission-setup/MissionSetupFlow.tsx`
- Test: `web/__tests__/onboarding/MissionSetupFlow.test.tsx`

Comportement attendu :
- `TOTAL` passe à `6`. Ordre : `Bienvenue(1) → Discipline(2) → Mission(3) → Mode(4) → Zones FC(5) → Données(6)`.
- Étape FC : bouton principal **« Déduire automatiquement (recommandé) »** → `PATCH { hr_zone_method: 'deduced' }`. Lien repliable **« Je connais ma FC max »** → champ FC max (→ `pct_max` + `max_hr`) avec sous-lien « Je ne la connais pas » → champ année de naissance (→ `auto` + `birth_year`). Encart explicatif. Étape **skippable** (`canNext` = true).
- Le `hr_zone_method`/`max_hr`/`birth_year` sont persistés **à la sélection** (comme les autres réponses), donc ils survivent au round-trip Strava. Ils ne font pas partie de `OnboardingAnswers` et ne sont pas ré-hydratés (déjà en base).

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `web/__tests__/onboarding/MissionSetupFlow.test.tsx` (à l'intérieur du `describe`) :

```ts
  // Helper : avance jusqu'à l'étape Zones FC (5) en sélectionnant le minimum.
  function gotoHrStep() {
    render(<MissionSetupFlow />)
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))           // 1→2
    fireEvent.click(screen.getByRole('button', { name: /^trail/i }))              // discipline
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))           // 2→3
    fireEvent.click(screen.getByRole('button', { name: /préparer un trail/i }))   // mission
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))           // 3→4
    fireEvent.click(screen.getByRole('button', { name: /mode mission/i }))        // mode
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))           // 4→5 (Zones FC)
  }

  it('le flow compte 6 étapes', () => {
    render(<MissionSetupFlow />)
    expect(screen.getByText(/étape 1 sur 6/i)).toBeInTheDocument()
  })

  it('« Déduire automatiquement » persiste hr_zone_method=deduced', async () => {
    gotoHrStep()
    fireEvent.click(screen.getByRole('button', { name: /déduire automatiquement/i }))
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const bodies = calls.map(c => JSON.parse(c[1].body))
      expect(bodies.some(b => b.hr_zone_method === 'deduced')).toBe(true)
    })
  })

  it('le fallback FC max persiste pct_max + max_hr', async () => {
    gotoHrStep()
    fireEvent.click(screen.getByRole('button', { name: /je connais ma fc max/i }))
    fireEvent.change(screen.getByLabelText(/fc max/i), { target: { value: '190' } })
    fireEvent.click(screen.getByRole('button', { name: /valider mes zones/i }))
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const bodies = calls.map(c => JSON.parse(c[1].body))
      expect(bodies.some(b => b.hr_zone_method === 'pct_max' && b.max_hr === 190)).toBe(true)
    })
  })

  it('l\'étape Zones FC est skippable (Continuer actif sans choix FC)', () => {
    gotoHrStep()
    expect(screen.getByRole('button', { name: /continuer/i })).not.toBeDisabled()
  })
```

- [ ] **Step 2: Lancer les tests → échec attendu**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/onboarding/MissionSetupFlow.test.tsx`
Expected: FAIL (textes « étape 1 sur 6 », « déduire automatiquement », etc. introuvables).

- [ ] **Step 3: `TOTAL` → 6 et imports d'icônes**

Dans `MissionSetupFlow.tsx`, modifier la ligne `const TOTAL = 5` :

```ts
const TOTAL = 6
```

Ajouter `HeartPulse` à l'import lucide-react (ligne ~5-10) :

```ts
import {
  ArrowRight, ArrowLeft, Check,
  Mountain, Footprints, Bike, Waves, Medal,
  Activity, TrendingUp, Compass, BarChart3,
  Upload, Watch, Rocket, HeartPulse,
} from 'lucide-react'
```

- [ ] **Step 4: Ajouter l'état FC + le persisteur**

Dans le composant `MissionSetupFlow`, après la ligne `const [dataSource, setDataSource] = useState<...>(...)` (vers `:137`), ajouter :

```ts
  const [hrMethod, setHrMethod] = useState<'deduced' | 'pct_max' | 'auto' | null>(null)
  const [showManualHr, setShowManualHr] = useState(false)
  const [showAgeHr, setShowAgeHr] = useState(false)
  const [maxHrInput, setMaxHrInput] = useState('')
  const [birthYearInput, setBirthYearInput] = useState('')

  function chooseDeduced() {
    setHrMethod('deduced')
    void persist({ hr_zone_method: 'deduced' })
  }

  function validateManualHr() {
    const maxHr = Number(maxHrInput)
    const birthYear = Number(birthYearInput)
    if (maxHrInput && Number.isFinite(maxHr) && maxHr > 0) {
      setHrMethod('pct_max')
      void persist({ hr_zone_method: 'pct_max', max_hr: maxHr })
    } else if (birthYearInput && Number.isFinite(birthYear) && birthYear > 1900) {
      setHrMethod('auto')
      void persist({ hr_zone_method: 'auto', birth_year: birthYear })
    }
  }
```

- [ ] **Step 5: Renuméroter l'étape Données de 5 → 6**

Dans le bloc `{step === 5 && (` qui rend l'étape « Données » (vers `:323`), changer la condition en `{step === 6 && (` et son `stepKey={5}` en `stepKey={6}`. **Ne pas toucher** au contenu interne de l'étape Données.

- [ ] **Step 6: Insérer l'étape Zones FC (nouveau step 5) avant l'étape Données**

Juste **avant** le bloc `{step === 6 && (` (ex-Données), insérer :

```tsx
            {step === 5 && (
              <StepShell stepKey={5} eyebrow="Fréquence cardiaque" title="Tes zones de FC"
                subtitle="Tes zones FC alimentent l'intensité, la charge et la fraîcheur. Tu pourras affiner dans Réglages.">
                <div className="grid gap-2.5">
                  <button
                    type="button"
                    onClick={chooseDeduced}
                    aria-pressed={hrMethod === 'deduced'}
                    className={cn(
                      'flex items-center gap-3.5 rounded-xl border bg-ink-700 p-4 text-left hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
                      hrMethod === 'deduced' ? 'border-primary' : 'border-ink-600',
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
                      <HeartPulse size={22} />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-[15px] font-semibold tracking-tight text-fg-primary">Déduire automatiquement</p>
                      <p className="font-body text-[12.5px] text-fg-muted">Recommandé · on analyse ton historique Strava</p>
                    </div>
                    {hrMethod === 'deduced' && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check size={13} className="text-ink-900" strokeWidth={3} />
                      </span>
                    )}
                  </button>

                  {!showManualHr ? (
                    <button
                      type="button"
                      onClick={() => setShowManualHr(true)}
                      className="text-left font-body text-[13px] text-fg-muted underline underline-offset-2 hover:text-fg-primary px-1 py-2"
                    >
                      Je connais ma FC max
                    </button>
                  ) : (
                    <div className="rounded-xl border border-ink-600 bg-ink-700 p-4 grid gap-3">
                      {!showAgeHr ? (
                        <label className="grid gap-1.5">
                          <span className="font-body text-[12.5px] text-fg-muted">FC max (bpm)</span>
                          <input
                            type="number" inputMode="numeric" value={maxHrInput}
                            onChange={(e) => setMaxHrInput(e.target.value)}
                            placeholder="ex. 190"
                            className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          />
                          <button type="button" onClick={() => { setShowAgeHr(true); setMaxHrInput('') }}
                            className="justify-self-start font-body text-[12px] text-fg-muted underline underline-offset-2 hover:text-fg-primary">
                            Je ne la connais pas
                          </button>
                        </label>
                      ) : (
                        <label className="grid gap-1.5">
                          <span className="font-body text-[12.5px] text-fg-muted">Année de naissance</span>
                          <input
                            type="number" inputMode="numeric" value={birthYearInput}
                            onChange={(e) => setBirthYearInput(e.target.value)}
                            placeholder="ex. 1988"
                            className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          />
                          <span className="font-body text-[11px] text-fg-muted">On estimera ta FC max par l&apos;âge.</span>
                        </label>
                      )}
                      <Button onClick={validateManualHr}>Valider mes zones</Button>
                      {(hrMethod === 'pct_max' || hrMethod === 'auto') && (
                        <p className="font-body text-[12px] text-primary-text">Zones enregistrées ✓</p>
                      )}
                    </div>
                  )}
                </div>
              </StepShell>
            )}
```

- [ ] **Step 7: Lancer les tests du flow → succès attendu**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/onboarding/MissionSetupFlow.test.tsx`
Expected: PASS (anciens tests + 4 nouveaux). Les anciens tests qui partaient sur l'étape Données via `stravaStatus` restent valides (l'étape Données reste la dernière, `TOTAL`).

- [ ] **Step 8: Vérifier TypeScript + lint**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx next lint --file components/onboarding/mission-setup/MissionSetupFlow.tsx`
Expected: aucune erreur.

- [ ] **Step 9: Commit**

```
git add web/components/onboarding/mission-setup/MissionSetupFlow.tsx web/__tests__/onboarding/MissionSetupFlow.test.tsx
git commit -m "feat(onboarding): étape Zones FC + flow 6 étapes (Lot 1)"
```

---

### Task 5: Cocher le suivi + vérification finale

**Files:**
- Modify: `tasks/onboarding-fonctionnel-suivi.md`

- [ ] **Step 1: Cocher les items du Lot 1**

Dans `tasks/onboarding-fonctionnel-suivi.md`, section « Lot 1 », passer en `[x]` les items livrés et ajouter la date + le SHA court du commit de merge en fin de ligne « Lot 1 ».

- [ ] **Step 2: Suite de tests pertinente verte**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/onboarding/MissionSetupFlow.test.tsx __tests__/lib/profile/seed-app-mode.test.ts`
Expected: PASS. (Ne pas lancer toute la suite : ~50 tests i18n échouent en pré-existant, cf. memory.)

- [ ] **Step 3: Vérification manuelle (Franck ou contrôleur)**

1. `npm run dev` dans `web/`, créer/réinitialiser un compte sans onboarding complété.
2. Parcourir le flow : vérifier « Étape X sur 6 », l'étape Zones FC, le choix « Déduire automatiquement » et le fallback FC max.
3. Choisir « Mode Mission » à l'étape 4, terminer **sans** Strava (« Entrer dans le cockpit ») → vérifier que le dashboard s'ouvre en Mode Mission.
4. (Optionnel) Refaire en chemin Strava → vérifier le Mode au retour sur le dashboard.

- [ ] **Step 4: Commit du suivi**

```
git add tasks/onboarding-fonctionnel-suivi.md
git commit -m "docs(onboarding): coche Lot 1 (étape FC + Mode défaut) dans le suivi"
```

- [ ] **Step 5: Build autoritatif sur Vercel**

Pousser la branche `feat/onboarding-lot1-fc-mode` et attendre le retour Vercel **avant** tout merge sur `master` (lesson 2026-05-29 : le build local Windows est muet/non fiable). Merge sur `master` seulement après build Vercel vert.

---

## Self-review (couverture spec Lot 1)

- **③ Mode → défaut app_mode** : Tasks 1–3 (seed `ui_preferences.app_mode` aux deux chemins de complétion, via helper testé). ✓
- **⑤ Étape Zones FC** (deduce-auto recommandé + fallback %FCmax 1 champ + skippable + encart) : Task 4. ✓
- **Proposition A (année de naissance)** : Task 4 (fallback `auto` → `birth_year`). ✓
- **Flow 6 étapes** : Task 4 (`TOTAL = 6`, renumérotation Données). ✓
- **Pas de migration** : confirmé (champs FC déjà dans l'allowlist `/api/profile`). ✓
- **Hors périmètre Lot 1** : Discipline (①), Mission/biblio (②), Réglages (D), Import (④) — non touchés. ✓
