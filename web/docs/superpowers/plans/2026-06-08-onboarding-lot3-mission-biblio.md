# Onboarding fonctionnel — Lot 3 (Mission → biblio Plan + renommage Route + date course) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps en `- [ ]`.

**Goal:** Rendre la sélection « Mission » fonctionnelle : renommer « marathon » → « Route (10 km, semi, marathon) », curer la bibliothèque Plan selon l'objectif (ordre + séance clé épinglée), collecter une date de course optionnelle, et appuyer l'emphase Charge en Mode Mission.

**Architecture:** Lecture-comme-défaut. La page Plan (serveur) lit `onboarding_mission`, le passe à `PlanClient` → `BibliothequeSeancesBlock`, qui **réordonne** (ne filtre/supprime pas) les templates : séance clé en tête puis types pertinents, **seulement** quand aucun filtre type ni recherche n'est actif. La date de course optionnelle est collectée à l'étape Mission et stockée (`onboarding_race_date`, graine future Structure Prépa). Le Mode Mission charge déjà via `MISSION_VISIBLE` ; on garantit `charge`+`freshness` quand `onboarding_mission='charge'`.

**Tech Stack:** Next.js 14, TS, React, Supabase, Jest.

**Branche / worktree :** `feat/onboarding-lot3-mission-biblio` dans le worktree isolé `.claude/worktrees/onboarding-lot2-discipline-sport` (HEAD séparé d'une session concurrente). Contrôleur fait tous les commits ; vérifier `git rev-parse --abbrev-ref HEAD == feat/onboarding-lot3-mission-biblio` avant chaque commit ; subagents ne lancent aucun git (lesson 2026-06-05/08).

**Réf spec :** `docs/superpowers/specs/2026-06-08-onboarding-fonctionnel-design.md` section ②.

**⚠️ Migration non auto-appliquée :** la migration 034 doit être collée par Franck dans le Supabase SQL Editor. Ne pas prétendre la feature « mission='route' » live tant que ce n'est pas fait.

---

### Task 1: Migration 034 — `onboarding_race_date` + backfill `marathon`→`route`

**Files:** Create `web/supabase/migrations/034_onboarding_race_date.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Lot 3 onboarding fonctionnel.
-- 1) Date de course optionnelle (proposition B) : graine future de la Structure Prépa.
alter table profiles
  add column if not exists onboarding_race_date date;

-- 2) Renommage de l'id mission « marathon » → « route »
--    (libellé « Préparer une course sur route », couvre 10 km / semi / marathon).
update profiles set onboarding_mission = 'route' where onboarding_mission = 'marathon';
```

- [ ] **Step 2: Commit** (le contrôleur rappelle à Franck d'appliquer le SQL)

```
git add web/supabase/migrations/034_onboarding_race_date.sql
git commit -m "feat(db): migration 034 onboarding_race_date + backfill marathon->route (Lot 3)"
```

---

### Task 2: Allowlist `/api/profile` + renommage mission marathon→route

**Files:**
- Modify: `web/app/api/profile/route.ts`
- Modify: `web/components/onboarding/mission-setup/MissionSetupFlow.tsx`

- [ ] **Step 1: Allowlist** — ajouter `'onboarding_race_date'` au tableau `allowed` de `route.ts` (à la suite des autres `onboarding_*`).

- [ ] **Step 2: Renommer l'option mission** dans `MissionSetupFlow.tsx`, tableau `MISSIONS`. Remplacer l'entrée :
```ts
{ id: 'marathon', label: 'Préparer un marathon',          desc: 'Route, allure cible',            icon: Footprints,  accent: 'var(--data-run)' },
```
par :
```ts
{ id: 'route',    label: 'Préparer une course sur route', desc: '10 km, semi, marathon',          icon: Footprints,  accent: 'var(--data-run)' },
```
(L'id `'route'` est persisté via le `selectAndPersist('onboarding_mission', ...)` existant — aucun autre changement de persistance. Les anciens comptes `'marathon'` sont migrés par la migration 034.)

- [ ] **Step 3: tsc** — `cd <worktree>/web && npx tsc --noEmit` → OK.

- [ ] **Step 4: Commit** — `route.ts` + `MissionSetupFlow.tsx` :
`feat(onboarding): mission « Route (10km/semi/marathon) » + allowlist race_date (Lot 3)`

---

### Task 3: Proposition B — champ date de course optionnel (étape Mission)

**Files:** Modify `web/components/onboarding/mission-setup/MissionSetupFlow.tsx`
**Test:** `web/__tests__/onboarding/MissionSetupFlow.test.tsx`

- [ ] **Step 1: Test (TDD)** — ajouter dans le describe :
```ts
it('affiche un champ date de course optionnel pour mission=route et le persiste', async () => {
  render(<MissionSetupFlow />)
  fireEvent.click(screen.getByRole('button', { name: /continuer/i }))            // 1→2
  fireEvent.click(screen.getByRole('button', { name: /^trail/i }))               // discipline
  fireEvent.click(screen.getByRole('button', { name: /continuer/i }))            // 2→3 (Mission)
  fireEvent.click(screen.getByRole('button', { name: /préparer une course sur route/i }))
  const dateInput = screen.getByLabelText(/date de course/i)
  fireEvent.change(dateInput, { target: { value: '2026-10-18' } })
  await waitFor(() => {
    const bodies = (global.fetch as jest.Mock).mock.calls.map(c => JSON.parse(c[1].body))
    expect(bodies.some(b => b.onboarding_race_date === '2026-10-18')).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer → échec** (`cd <worktree>/web && npx jest __tests__/onboarding/MissionSetupFlow.test.tsx`).

- [ ] **Step 3: Implémenter** — état + persistance + champ conditionnel à l'étape 3.
  - Ajouter l'état : `const [raceDate, setRaceDate] = useState<string | null>(initialAnswers?.raceDate ?? null)`.
  - Étendre le type `OnboardingAnswers` avec `raceDate: string | null`, et l'init via `initialAnswers?.raceDate`.
  - Dans le bloc `{step === 3 && (` (Mission), sous la grille des missions, ajouter — visible uniquement si `mission === 'trail' || mission === 'route'` :
```tsx
{(mission === 'trail' || mission === 'route') && (
  <label className="mt-4 grid gap-1.5">
    <span className="font-body text-[12.5px] text-fg-muted">As-tu une date de course&nbsp;? (optionnel)</span>
    <input
      type="date"
      aria-label="Date de course"
      value={raceDate ?? ''}
      onChange={(e) => { const v = e.target.value || null; setRaceDate(v); void persist({ onboarding_race_date: v }) }}
      className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    />
  </label>
)}
```
  - Inclure `onboarding_race_date: raceDate` dans `answersPayload()` (pour le chemin de complétion sans-Strava).

- [ ] **Step 4: Lancer → succès** + tous les tests du flow verts.

- [ ] **Step 5: Commit** — `feat(onboarding): date de course optionnelle (proposition B, Lot 3)`

---

### Task 4: Module de curation + ordonnancement de la bibliothèque

**Files:**
- Create: `web/lib/training/mission-curation.ts`
- Test: `web/__tests__/lib/training/mission-curation.test.ts`
- Modify: `web/components/plan/BibliothequeSeancesBlock.tsx`
- Modify: `web/app/(main)/plan/page.tsx`, `web/app/(main)/plan/PlanClient.tsx`

- [ ] **Step 1: Test du module (TDD)** — `__tests__/lib/training/mission-curation.test.ts` :
```ts
import { curateTemplatesForMission } from '@/lib/training/mission-curation'
import { SESSION_TEMPLATES } from '@/lib/training/session-templates'

describe('curateTemplatesForMission', () => {
  it('épingle la séance clé en tête pour trail', () => {
    const out = curateTemplatesForMission(SESSION_TEMPLATES, 'trail')
    expect(out[0].id).toBe('co-4x4min')
  })
  it('épingle la séance clé en tête pour route', () => {
    const out = curateTemplatesForMission(SESSION_TEMPLATES, 'route')
    expect(out[0].id).toBe('se-2x20')
  })
  it('priorise les types pertinents trail (cotes/SL/footing/tempo) avant le cross-training', () => {
    const out = curateTemplatesForMission(SESSION_TEMPLATES, 'trail')
    const idxCote = out.findIndex(t => t.type === 'cotes')
    const idxVelo = out.findIndex(t => t.type === 'velo')
    expect(idxCote).toBeLessThan(idxVelo)
  })
  it('retourne la liste inchangée pour charge / libre / null', () => {
    const ref = SESSION_TEMPLATES
    expect(curateTemplatesForMission(ref, 'charge')).toBe(ref)
    expect(curateTemplatesForMission(ref, 'libre')).toBe(ref)
    expect(curateTemplatesForMission(ref, null)).toBe(ref)
  })
  it('ne perd ni ne duplique aucun template', () => {
    const out = curateTemplatesForMission(SESSION_TEMPLATES, 'route')
    expect(out).toHaveLength(SESSION_TEMPLATES.length)
    expect(new Set(out.map(t => t.id)).size).toBe(SESSION_TEMPLATES.length)
  })
})
```

- [ ] **Step 2: Lancer → échec.**

- [ ] **Step 3: Implémenter `mission-curation.ts`**
```ts
import type { SessionTemplate } from '@/types/plan'

// Types de séances pertinents par objectif (cf. validation Franck) :
// route = tout ce qui rentre dans un plan route ; trail = plan trail/ultra.
const MISSION_RELEVANT_TYPES: Record<string, ReadonlyArray<SessionTemplate['type']>> = {
  route: ['footing', 'seuil_tempo', 'fractionne', 'sortie_longue', 'course'],
  trail: ['footing', 'sortie_longue', 'seuil_tempo', 'cotes', 'course'],
}

// Séance clé épinglée en tête de la vue curée, par objectif.
const MISSION_KEY_SESSION: Record<string, string> = {
  trail: 'co-4x4min',  // 4×4min côtes longues
  route: 'se-2x20',    // 2×20min seuil
}

/**
 * Réordonne (sans filtrer ni dédupliquer) les templates pour mettre en avant
 * ce qui sert l'objectif : séance clé en tête, puis types pertinents, puis le
 * reste (cross-training inclus). Pour charge/libre/inconnu/null : liste inchangée
 * (même référence).
 */
export function curateTemplatesForMission(
  templates: SessionTemplate[],
  mission: string | null | undefined,
): SessionTemplate[] {
  const relevant = mission ? MISSION_RELEVANT_TYPES[mission] : undefined
  if (!mission || !relevant) return templates
  const keyId = MISSION_KEY_SESSION[mission]
  const rank = (t: SessionTemplate): number => {
    if (t.id === keyId) return 0
    return relevant.includes(t.type) ? 1 : 2
  }
  // Tri stable : on conserve l'ordre d'origine au sein d'un même rang.
  return templates
    .map((t, i) => ({ t, i, r: rank(t) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.t)
}
```

- [ ] **Step 4: Lancer → succès.**

- [ ] **Step 5: Câbler le flux mission**
  - `web/app/(main)/plan/page.tsx` : fetcher `onboarding_mission` du profil (via `createClient()` + `supabase.from('profiles').select('onboarding_mission').eq('id', user.id).maybeSingle()`, en récupérant `user` via `getServerUser()`), puis `<PlanClient mode={mode} mission={profile?.onboarding_mission ?? null} />`.
  - `PlanClient.tsx` : ajouter `mission` à la signature (`{ mode = 'expert', mission = null }: { mode?: 'mission'|'expert'; mission?: string | null }`), et passer `<BibliothequeSeancesBlock mission={mission} />`.
  - `BibliothequeSeancesBlock.tsx` : ajouter une prop `mission?: string | null`. Importer `curateTemplatesForMission`. Dans le `useMemo` `allTemplates`, après le merge `[...custom, ...visibleSystem]`, retourner `curateTemplatesForMission([...custom, ...visibleSystem], mission)`. **Important** : n'appliquer la curation que comme **ordre par défaut** — elle agit sur `allTemplates`, et `filtered` (recherche/type) continue de filtrer par-dessus. Quand l'utilisateur sélectionne un type ou tape une recherche, l'ordre curé reste mais le sous-ensemble est filtré normalement (non destructif). Pas de toggle dédié : le « Voir plus » existant révèle déjà tout.

- [ ] **Step 6: tsc + lint** des fichiers touchés → OK.

- [ ] **Step 7: Commit** — module + test + biblio + page + client :
`feat(plan): curation de la bibliothèque par objectif (séance clé + types pertinents) (Lot 3)`

---

### Task 5: Emphase Charge en Mode Mission quand `mission='charge'`

**Files:** Modify `web/app/(main)/dashboard/page.tsx`, `web/components/cockpit/DashboardGrid.tsx`

- [ ] **Step 1:** `dashboard/page.tsx` — ajouter `onboarding_mission` au `.select(...)` profil et passer `mission={athleteProfile?.onboarding_mission ?? null}` à `<DashboardGrid>`.

- [ ] **Step 2:** `DashboardGrid.tsx` — ajouter `mission?: string | null` aux `Props`, le déstructurer. Le `MISSION_VISIBLE` actuel inclut déjà `freshness` (si payload) ; mais il **n'inclut pas `charge`**. Quand `mode === 'mission'` ET `mission === 'charge'`, ajouter `'charge'` à la liste `missionVisible` (et conserver `freshness`). Exemple :
```ts
let missionVisible = mode === 'mission'
  ? MISSION_VISIBLE.filter(id => id !== 'freshness' || freshnessPayload != null)
  : undefined
if (missionVisible && mission === 'charge' && !missionVisible.includes('charge')) {
  // Insère le bloc Charge juste après morningReport pour le mettre en avant.
  missionVisible = ['morningReport', 'charge', ...missionVisible.filter(id => id !== 'morningReport' && id !== 'charge')]
}
```
(Le bloc `charge` existe déjà dans `blocks`. Vérifier que l'ordre reste cohérent avec le rendu Mission desktop 2 colonnes.)

- [ ] **Step 3: tsc** → OK.

- [ ] **Step 4: Commit** — `feat(cockpit): emphase Charge en Mode Mission pour mission='charge' (Lot 3)`

---

### Task 6: Suivi + vérif + push/Vercel/merge

- [ ] **Step 1:** Cocher le **Lot 3** dans `tasks/onboarding-fonctionnel-suivi.md` (date + SHAs).
- [ ] **Step 2:** Lancer les suites pertinentes :
`cd <worktree>/web && npx jest __tests__/onboarding/MissionSetupFlow.test.tsx __tests__/lib/training/mission-curation.test.ts`
- [ ] **Step 3:** `npx tsc --noEmit` global → OK ; lint des fichiers touchés.
- [ ] **Step 4:** Commit suivi. Push `feat/onboarding-lot3-mission-biblio` → attendre build Vercel preview vert → fast-forward `master`.
- [ ] **Step 5 (Franck) :** coller la **migration 034** dans le Supabase SQL Editor. Vérif manuelle : nouvel onboarding, mission « course sur route » → biblio Plan ordonne seuil/VMA/SL en tête, séance clé `2×20min Seuil` en 1ère ; mission charge + Mode Mission → bloc Charge mis en avant.

---

## Self-review (couverture spec Lot 3)

- **Renommage « Route (10 km, semi, marathon) »** : Task 2 (+ migration backfill Task 1). ✓
- **Curation biblio par objectif + séance clé** : Task 4 (ordonnancement non destructif, fitte l'UI FilterBar+VoirPlus). ✓
- **Proposition B (date course optionnelle)** : Task 3. ✓
- **Emphase Mode Mission charge** : Task 5. ✓
- **Migration non auto-appliquée** : Task 1 + rappel Task 6 Step 5. ✓
- **Lecture-comme-défaut** : mission lue côté serveur, curation = ordre par défaut surchargé par recherche/filtre utilisateur. ✓

## Drift notes
- Curation implémentée en **ordonnancement** (pas filtrage/masquage) pour épouser le `FilterBar` mono-select + « Voir plus » existants — le spec parlait de « vue curée + toggle Tout afficher » ; le « Voir plus » tient lieu de toggle.
